import { ipcMain } from 'electron'
import {
  CleanupFindingSchema,
  DiagnosticLogEntrySchema,
  DiagnosticsSnapshotSchema,
  InstallQueueItemSchema,
  InstalledAppEntrySchema,
  ReadinessSnapshotSchema,
  SettingsStateSchema,
  UninstallResultSchema,
  ipcChannels,
  type BuildInfo,
  type CleanupFinding,
  type DiagnosticLogEntry,
  type InstallQueueItem,
  type InstalledAppEntry,
  type ReadinessSnapshot,
  type SettingsState
} from '@shared/contracts'
import {
  buildCleanupActionResult,
  buildQueueEvent,
  buildUninstallResult,
  createHarnessFixture
} from '@main/harness/fixtures'

type Publisher = (channel: string, payload: unknown) => void

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function registerHarnessIpcHandlers(fixtureName: string | undefined, build: BuildInfo, publish: Publisher): void {
  const state = createHarnessFixture(fixtureName, build)

  const pushDiagnostic = (entry: Omit<DiagnosticLogEntry, 'id' | 'timestamp'>): void => {
    const nextEntry = DiagnosticLogEntrySchema.parse({
      id: `diag-${state.diagnostics.entries.length + 1}`,
      timestamp: new Date().toISOString(),
      ...entry
    })

    state.diagnostics.entries.unshift(nextEntry)
    if (state.diagnostics.entries.length > 300) {
      state.diagnostics.entries.length = 300
    }
    publish(ipcChannels.diagnosticsEvent, nextEntry)
  }

  const publishQueue = (): void => {
    publish(ipcChannels.queueEvent, buildQueueEvent(state.queue.map((item) => InstallQueueItemSchema.parse(item))))
  }

  ipcMain.handle(ipcChannels.getSettings, async () => SettingsStateSchema.parse(state.settings))
  ipcMain.handle(ipcChannels.getReadiness, async () => {
    if (state.delays.readinessMs > 0) {
      await delay(state.delays.readinessMs)
    }
    return ReadinessSnapshotSchema.parse(state.readiness)
  })
  ipcMain.handle(ipcChannels.runSetupCheck, async () => {
    if (state.delays.readinessMs > 0) {
      await delay(state.delays.readinessMs)
    }
    return ReadinessSnapshotSchema.parse(state.readiness)
  })
  ipcMain.handle(ipcChannels.saveAdbPath, async (_event, adbPath?: string) => {
    state.settings = SettingsStateSchema.parse({
      ...state.settings,
      adbPath: adbPath || undefined,
      wizardCompleted: false
    })
    pushDiagnostic({
      level: 'info',
      source: 'settings',
      message: 'Harness saved adb.exe path'
    })
    return state.settings
  })
  ipcMain.handle(ipcChannels.setManualEndpoint, async (_event, manualEndpoint?: string) => {
    state.settings = SettingsStateSchema.parse({
      ...state.settings,
      manualEndpoint: manualEndpoint || undefined,
      wizardCompleted: false
    })
    pushDiagnostic({
      level: 'info',
      source: 'settings',
      message: 'Harness saved manual endpoint'
    })
    return state.settings
  })
  ipcMain.handle(ipcChannels.pickAdbPath, async () => 'C:\\Android\\platform-tools\\adb.exe')
  ipcMain.handle(ipcChannels.pickApkFiles, async () => ['C:\\Fixtures\\Example.apk'])
  ipcMain.handle(ipcChannels.enqueueApks, async (_event, filePaths: string[]) => {
    const createdAt = new Date().toISOString()
    const nextItems = filePaths.map((filePath, index) =>
      InstallQueueItemSchema.parse({
        id: `harness-queue-${Date.now()}-${index}`,
        filePath,
        fileName: filePath.split('\\').pop() ?? 'Unknown.apk',
        displayName: filePath.split('\\').pop()?.replace(/\.apk$/i, '') ?? 'Unknown',
        sizeBytes: 18_000_000 + index * 2_000_000,
        state: 'queued',
        progress: 12,
        createdAt,
        updatedAt: createdAt
      })
    )

    state.queue = [...nextItems, ...state.queue]
    publishQueue()
    pushDiagnostic({
      level: 'info',
      source: 'queue',
      message: `Harness queued ${filePaths.length} APK file(s)`
    })
    return state.queue
  })
  ipcMain.handle(ipcChannels.getInstallQueue, async () => state.queue.map((item) => InstallQueueItemSchema.parse(item)))
  ipcMain.handle(ipcChannels.listInstalledApps, async () => state.apps.map((item) => InstalledAppEntrySchema.parse(item)))
  ipcMain.handle(ipcChannels.uninstallApp, async (_event, packageName: string) => {
    state.apps = state.apps.filter((item) => item.packageName !== packageName)
    const result = buildUninstallResult(packageName, state.cleanupScan)
    pushDiagnostic({
      level: 'warn',
      source: 'catalog',
      message: `Harness uninstalled ${packageName}`
    })
    return UninstallResultSchema.parse(result)
  })
  ipcMain.handle(ipcChannels.scanCleanup, async (_event, packageName?: string) => {
    if (!packageName) {
      return state.cleanupScan
    }

    return {
      ...state.cleanupScan,
      findings: state.cleanupScan.findings.filter((finding) => finding.packageName === packageName)
    }
  })
  ipcMain.handle(ipcChannels.applyCleanup, async (_event, findings: unknown[]) => {
    const parsedFindings = findings.map((finding) => CleanupFindingSchema.parse(finding))
    const selectedIds = new Set(parsedFindings.map((finding) => finding.id))
    state.cleanupScan = {
      ...state.cleanupScan,
      findings: state.cleanupScan.findings.filter((finding) => !selectedIds.has(finding.id))
    }
    pushDiagnostic({
      level: 'success',
      source: 'cleanup',
      message: `Harness removed ${parsedFindings.length} cleanup artifact(s)`
    })
    return buildCleanupActionResult(parsedFindings)
  })
  ipcMain.handle(ipcChannels.getDiagnostics, async () => DiagnosticsSnapshotSchema.parse(state.diagnostics))
  ipcMain.handle(ipcChannels.clearDiagnostics, async () => {
    state.diagnostics.entries = []
  })
  ipcMain.handle(ipcChannels.wakeWsa, async () => {
    state.readiness = ReadinessSnapshotSchema.parse({
      ...state.readiness,
      overallStatus: 'ready',
      wizardCompleted: true,
      needsSetup: false,
      wsa: {
        ...state.readiness.wsa,
        status: 'ready',
        message: undefined
      },
      connection: {
        status: 'connected',
        endpoint: '127.0.0.1:58526',
        checkedEndpoints: ['127.0.0.1:58526'],
        message: 'Connected to WSA.'
      },
      messages: ['Connected to WSA at 127.0.0.1:58526.']
    })
    state.settings = SettingsStateSchema.parse({
      ...state.settings,
      wizardCompleted: true
    })
    pushDiagnostic({
      level: 'success',
      source: 'wsa',
      message: 'Harness woke WSA and marked the app ready'
    })
    return true
  })
}

