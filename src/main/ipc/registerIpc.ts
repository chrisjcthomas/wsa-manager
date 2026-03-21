import { dialog, ipcMain } from 'electron'
import { CleanupFindingSchema, ipcChannels, UninstallResultSchema } from '@shared/contracts'
import { CleanupService } from '@main/services/cleanup/CleanupService'
import { CatalogService } from '@main/services/catalog/CatalogService'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { SettingsStore } from '@main/storage/SettingsStore'
import { InstallQueueService } from '@main/tasks/InstallQueueService'
import { WsaService } from '@main/services/wsa/WsaService'

export interface AppServices {
  settingsStore: SettingsStore
  diagnostics: DiagnosticsService
  installQueue: InstallQueueService
  catalog: CatalogService
  cleanup: CleanupService
  wsa: WsaService
}

export function registerIpcHandlers(services: AppServices): void {
  ipcMain.handle(ipcChannels.getSettings, async () => services.settingsStore.get())
  ipcMain.handle(ipcChannels.getReadiness, async () => await services.wsa.getReadinessSnapshot())
  ipcMain.handle(ipcChannels.runSetupCheck, async () => await services.wsa.getReadinessSnapshot())
  ipcMain.handle(ipcChannels.saveAdbPath, async (_event, adbPath?: string) => services.settingsStore.setAdbPath(adbPath || undefined))
  ipcMain.handle(ipcChannels.setManualEndpoint, async (_event, manualEndpoint?: string) => services.settingsStore.setManualEndpoint(manualEndpoint || undefined))
  ipcMain.handle(ipcChannels.pickAdbPath, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose adb.exe',
      properties: ['openFile'],
      filters: [{ name: 'ADB executable', extensions: ['exe'] }]
    })

    return result.canceled ? undefined : result.filePaths[0]
  })
  ipcMain.handle(ipcChannels.pickApkFiles, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose APK files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'APK files', extensions: ['apk'] }]
    })

    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle(ipcChannels.enqueueApks, async (_event, filePaths: string[]) => await services.installQueue.enqueue(filePaths))
  ipcMain.handle(ipcChannels.getInstallQueue, async () => services.installQueue.getItems())
  ipcMain.handle(ipcChannels.listInstalledApps, async () => await services.catalog.listInstalledApps())
  ipcMain.handle(ipcChannels.uninstallApp, async (_event, packageName: string) => {
    const uninstallResult = await services.catalog.adbService.uninstallPackage(packageName)
    const cleanupScan = await services.cleanup.scan(packageName)
    services.diagnostics.log(
      uninstallResult.success ? 'success' : 'warn',
      'catalog',
      `${uninstallResult.success ? 'Uninstalled' : 'Failed to uninstall'} ${packageName}`,
      uninstallResult.message
    )

    return UninstallResultSchema.parse({
      packageName,
      removed: uninstallResult.success,
      cleanupScan,
      message: uninstallResult.message
    })
  })
  ipcMain.handle(ipcChannels.scanCleanup, async (_event, packageName?: string) => await services.cleanup.scan(packageName))
  ipcMain.handle(ipcChannels.applyCleanup, async (_event, findings: unknown[]) =>
    await services.cleanup.apply(findings.map((finding) => CleanupFindingSchema.parse(finding)))
  )
  ipcMain.handle(ipcChannels.getDiagnostics, async () => services.diagnostics.getSnapshot())
  ipcMain.handle(ipcChannels.clearDiagnostics, async () => services.diagnostics.clear())
  ipcMain.handle(ipcChannels.wakeWsa, async () => await services.wsa.wake())
}
