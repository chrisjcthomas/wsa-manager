import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { ipcChannels, InstallQueueEventSchema, InstallQueueItemSchema, type InstallQueueEvent, type InstallQueueItem } from '@shared/contracts'
import { deriveLabelFromFilePath } from '@shared/utils/display'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { AdbService } from '@main/services/adb/AdbService'
import { SettingsStore } from '@main/storage/SettingsStore'
import { WsaService } from '@main/services/wsa/WsaService'

type Publisher = (channel: string, payload: unknown) => void

export class InstallQueueService {
  private readonly items: InstallQueueItem[] = []
  private processing = false
  private publisher?: Publisher

  constructor(
    private readonly adbService: AdbService,
    private readonly wsaService: WsaService,
    private readonly settingsStore: SettingsStore,
    private readonly diagnostics: DiagnosticsService
  ) {}

  setPublisher(publisher: Publisher): void {
    this.publisher = publisher
  }

  getItems(): InstallQueueItem[] {
    return [...this.items]
  }

  async enqueue(paths: string[]): Promise<InstallQueueItem[]> {
    const created: InstallQueueItem[] = []

    for (const filePath of paths) {
      const fileName = filePath.split(/[\\/]/).at(-1) ?? filePath
      const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : undefined
      const isApk = filePath.toLowerCase().endsWith('.apk')
      const item = InstallQueueItemSchema.parse({
        id: randomUUID(),
        filePath,
        fileName,
        displayName: deriveLabelFromFilePath(filePath),
        sizeBytes: stats?.size ?? 0,
        state: isApk && stats?.isFile() ? 'queued' : 'rejected',
        progress: 0,
        error: isApk && stats?.isFile() ? undefined : 'Only existing .apk files are supported in v1.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      this.items.unshift(item)
      created.push(item)
    }

    this.emitSnapshot()
    void this.processQueue()
    return created
  }

  private emitSnapshot(): void {
    const event = InstallQueueEventSchema.parse({
      type: 'snapshot',
      items: this.items
    })
    this.publisher?.(ipcChannels.queueEvent, event)
  }

  private updateItem(id: string, patch: Partial<InstallQueueItem>): void {
    const index = this.items.findIndex((item) => item.id === id)
    if (index === -1) {
      return
    }

    this.items[index] = InstallQueueItemSchema.parse({
      ...this.items[index],
      ...patch,
      updatedAt: new Date().toISOString()
    })

    const event: InstallQueueEvent = InstallQueueEventSchema.parse({
      type: 'updated',
      items: this.items
    })
    this.publisher?.(ipcChannels.queueEvent, event)
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true
    try {
      while (true) {
        const nextItem = this.items.find((item) => item.state === 'queued')
        if (!nextItem) {
          break
        }

        await this.processItem(nextItem)
      }
    } finally {
      this.processing = false
    }
  }

  private async processItem(item: InstallQueueItem): Promise<void> {
    this.updateItem(item.id, { state: 'connecting', progress: 10 })
    this.diagnostics.log('info', 'queue', `Preparing install for ${item.fileName}`)

    try {
      await this.adbService.ensureServer()
      let connection = await this.wsaService.connectToBestEndpoint(this.settingsStore.get().manualEndpoint)

      if (!connection.connected) {
        await this.wsaService.wake()
        await new Promise((resolve) => setTimeout(resolve, 2_500))
        connection = await this.wsaService.connectToBestEndpoint(this.settingsStore.get().manualEndpoint)
      }

      if (!connection.connected) {
        throw new Error(connection.message)
      }

      this.updateItem(item.id, { state: 'installing', progress: 45 })
      const beforePackages = new Set(await this.adbService.listUserPackages())
      const installResult = await this.adbService.installApk(item.filePath)

      if (!installResult.success) {
        throw new Error(installResult.message)
      }

      const afterPackages = await this.adbService.listUserPackages()
      const newPackage = afterPackages.find((packageName) => !beforePackages.has(packageName))

      this.updateItem(item.id, {
        state: 'installed',
        progress: 100,
        packageName: newPackage
      })

      if (newPackage) {
        this.settingsStore.recordInstall({
          packageName: newPackage,
          label: item.displayName,
          fileName: item.fileName,
          installedAt: new Date().toISOString()
        })
      }

      this.diagnostics.log('success', 'queue', `Installed ${item.fileName}`, newPackage ? `Package: ${newPackage}` : undefined)
    } catch (error) {
      this.updateItem(item.id, {
        state: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : String(error)
      })
      this.diagnostics.log('error', 'queue', `Install failed for ${item.fileName}`, error instanceof Error ? error.message : String(error))
    }
  }
}
