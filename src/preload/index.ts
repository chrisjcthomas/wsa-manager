import { contextBridge, ipcRenderer } from 'electron'
import {
  CleanupActionResultSchema,
  CleanupFindingSchema,
  CleanupScanResultSchema,
  DiagnosticsSnapshotSchema,
  DiagnosticLogEntrySchema,
  InstallQueueEventSchema,
  InstallQueueItemSchema,
  InstalledAppEntrySchema,
  ReadinessSnapshotSchema,
  SettingsStateSchema,
  UninstallResultSchema,
  ipcChannels,
  type CleanupFinding,
  type CleanupActionResult,
  type CleanupScanResult,
  type DiagnosticsSnapshot,
  type DiagnosticLogEntry,
  type InstallQueueEvent,
  type InstallQueueItem,
  type InstalledAppEntry,
  type ReadinessSnapshot,
  type SettingsState,
  type UninstallResult
} from '@shared/contracts'

const wsaApi = {
  getSettings: async (): Promise<SettingsState> => SettingsStateSchema.parse(await ipcRenderer.invoke(ipcChannels.getSettings)),
  getReadiness: async (): Promise<ReadinessSnapshot> =>
    ReadinessSnapshotSchema.parse(await ipcRenderer.invoke(ipcChannels.getReadiness)),
  runSetupCheck: async (): Promise<ReadinessSnapshot> =>
    ReadinessSnapshotSchema.parse(await ipcRenderer.invoke(ipcChannels.runSetupCheck)),
  saveAdbPath: async (adbPath?: string): Promise<SettingsState> =>
    SettingsStateSchema.parse(await ipcRenderer.invoke(ipcChannels.saveAdbPath, adbPath)),
  setManualEndpoint: async (manualEndpoint?: string): Promise<SettingsState> =>
    SettingsStateSchema.parse(await ipcRenderer.invoke(ipcChannels.setManualEndpoint, manualEndpoint)),
  pickAdbPath: async (): Promise<string | undefined> => await ipcRenderer.invoke(ipcChannels.pickAdbPath),
  pickApkFiles: async (): Promise<string[]> => await ipcRenderer.invoke(ipcChannels.pickApkFiles),
  enqueueApks: async (filePaths: string[]): Promise<InstallQueueItem[]> =>
    (await ipcRenderer.invoke(ipcChannels.enqueueApks, filePaths)).map((item: unknown) => InstallQueueItemSchema.parse(item)),
  getInstallQueue: async (): Promise<InstallQueueItem[]> =>
    (await ipcRenderer.invoke(ipcChannels.getInstallQueue)).map((item: unknown) => InstallQueueItemSchema.parse(item)),
  subscribeQueueEvents: (listener: (event: InstallQueueEvent) => void): (() => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(InstallQueueEventSchema.parse(payload))
    }

    ipcRenderer.on(ipcChannels.queueEvent, wrappedListener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.queueEvent, wrappedListener)
    }
  },
  listInstalledApps: async (): Promise<InstalledAppEntry[]> =>
    (await ipcRenderer.invoke(ipcChannels.listInstalledApps)).map((item: unknown) => InstalledAppEntrySchema.parse(item)),
  uninstallApp: async (packageName: string): Promise<UninstallResult> =>
    UninstallResultSchema.parse(await ipcRenderer.invoke(ipcChannels.uninstallApp, packageName)),
  scanCleanup: async (packageName?: string): Promise<CleanupScanResult> =>
    CleanupScanResultSchema.parse(await ipcRenderer.invoke(ipcChannels.scanCleanup, packageName)),
  applyCleanup: async (findings: CleanupFinding[]): Promise<CleanupActionResult> =>
    CleanupActionResultSchema.parse(
      await ipcRenderer.invoke(
        ipcChannels.applyCleanup,
        findings.map((finding) => CleanupFindingSchema.parse(finding))
      )
    ),
  getDiagnostics: async (): Promise<DiagnosticsSnapshot> =>
    DiagnosticsSnapshotSchema.parse(await ipcRenderer.invoke(ipcChannels.getDiagnostics)),
  clearDiagnostics: async (): Promise<void> => {
    await ipcRenderer.invoke(ipcChannels.clearDiagnostics)
  },
  subscribeDiagnostics: (listener: (entry: DiagnosticLogEntry) => void): (() => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(DiagnosticLogEntrySchema.parse(payload))
    }

    ipcRenderer.on(ipcChannels.diagnosticsEvent, wrappedListener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.diagnosticsEvent, wrappedListener)
    }
  },
  wakeWsa: async (): Promise<boolean> => await ipcRenderer.invoke(ipcChannels.wakeWsa)
}

contextBridge.exposeInMainWorld('wsaApi', wsaApi)

export type WsaApi = typeof wsaApi
