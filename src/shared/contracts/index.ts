import { z } from 'zod'

export const settingsVersion = 1

export const ipcChannels = {
  getReadiness: 'readiness:get',
  runSetupCheck: 'readiness:runSetupCheck',
  saveAdbPath: 'settings:saveAdbPath',
  setManualEndpoint: 'settings:setManualEndpoint',
  getSettings: 'settings:get',
  pickAdbPath: 'settings:pickAdbPath',
  enqueueApks: 'queue:enqueueApks',
  getInstallQueue: 'queue:getInstallQueue',
  queueEvent: 'queue:event',
  listInstalledApps: 'catalog:listInstalledApps',
  uninstallApp: 'catalog:uninstallApp',
  scanCleanup: 'cleanup:scan',
  applyCleanup: 'cleanup:apply',
  getDiagnostics: 'diagnostics:get',
  clearDiagnostics: 'diagnostics:clear',
  diagnosticsEvent: 'diagnostics:event',
  wakeWsa: 'wsa:wake',
  pickApkFiles: 'queue:pickApkFiles'
} as const

export const DiagnosticLevelSchema = z.enum(['debug', 'info', 'success', 'warn', 'error'])

export const QueueItemStateSchema = z.enum([
  'queued',
  'connecting',
  'installing',
  'installed',
  'failed',
  'rejected'
])

export const CleanupArtifactTypeSchema = z.enum([
  'start_menu_shortcut',
  'desktop_shortcut',
  'registry_uninstall',
  'registry_class',
  'icon_cache'
])

export const ReadinessSnapshotSchema = z.object({
  checkedAt: z.string(),
  overallStatus: z.enum(['ready', 'needs_attention']),
  wizardCompleted: z.boolean(),
  needsSetup: z.boolean(),
  adb: z.object({
    status: z.enum(['ready', 'not_found', 'invalid', 'error']),
    path: z.string().optional(),
    version: z.string().optional(),
    source: z.string().optional(),
    message: z.string().optional()
  }),
  wsa: z.object({
    status: z.enum(['ready', 'not_found', 'sleeping', 'error']),
    packageName: z.string().optional(),
    packageFullName: z.string().optional(),
    version: z.string().optional(),
    installLocation: z.string().optional(),
    message: z.string().optional()
  }),
  connection: z.object({
    status: z.enum(['unknown', 'connected', 'not_connected', 'sleeping', 'adb_missing', 'wsa_missing']),
    endpoint: z.string().optional(),
    checkedEndpoints: z.array(z.string()),
    message: z.string().optional()
  }),
  messages: z.array(z.string())
})

export const InstallHistoryEntrySchema = z.object({
  packageName: z.string(),
  label: z.string(),
  fileName: z.string(),
  installedAt: z.string()
})

export const CleanupHistoryEntrySchema = z.object({
  packageName: z.string(),
  artifactCount: z.number().int().nonnegative(),
  completedAt: z.string()
})

export const SettingsStateSchema = z.object({
  version: z.literal(settingsVersion),
  wizardCompleted: z.boolean(),
  adbPath: z.string().optional(),
  manualEndpoint: z.string().optional(),
  recentInstalls: z.array(InstallHistoryEntrySchema),
  recentCleanupActions: z.array(CleanupHistoryEntrySchema)
})

export const InstallQueueItemSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  fileName: z.string(),
  displayName: z.string(),
  sizeBytes: z.number().nonnegative(),
  state: QueueItemStateSchema,
  progress: z.number().min(0).max(100),
  packageName: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const InstallQueueEventSchema = z.object({
  type: z.enum(['snapshot', 'updated']),
  items: z.array(InstallQueueItemSchema)
})

export const InstalledAppEntrySchema = z.object({
  packageName: z.string(),
  label: z.string(),
  labelSource: z.enum(['history', 'derived']),
  lastInstalledAt: z.string().optional(),
  status: z.enum(['idle', 'removing']),
  sizeLabel: z.string(),
  iconKind: z.literal('placeholder')
})

export const CleanupFindingSchema = z.object({
  id: z.string(),
  packageName: z.string(),
  label: z.string(),
  artifactType: CleanupArtifactTypeSchema,
  target: z.string(),
  locationLabel: z.string(),
  detail: z.string(),
  selectedByDefault: z.boolean()
})

export const CleanupScanResultSchema = z.object({
  scannedAt: z.string(),
  warnings: z.array(z.string()),
  findings: z.array(CleanupFindingSchema)
})

export const CleanupFailureSchema = z.object({
  findingId: z.string(),
  target: z.string(),
  reason: z.string()
})

export const CleanupActionResultSchema = z.object({
  requestedCount: z.number().int().nonnegative(),
  removed: z.array(CleanupFindingSchema),
  failed: z.array(CleanupFailureSchema),
  completedAt: z.string()
})

export const DiagnosticLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: DiagnosticLevelSchema,
  source: z.string(),
  message: z.string(),
  detail: z.string().optional()
})

export const BuildInfoSchema = z.object({
  appVersion: z.string(),
  buildTimestamp: z.string(),
  buildLabel: z.string()
})

export const DiagnosticsSnapshotSchema = z.object({
  build: BuildInfoSchema,
  entries: z.array(DiagnosticLogEntrySchema)
})

export const UninstallResultSchema = z.object({
  packageName: z.string(),
  removed: z.boolean(),
  cleanupScan: CleanupScanResultSchema,
  message: z.string()
})

export type CleanupActionResult = z.infer<typeof CleanupActionResultSchema>
export type CleanupHistoryEntry = z.infer<typeof CleanupHistoryEntrySchema>
export type CleanupFinding = z.infer<typeof CleanupFindingSchema>
export type CleanupScanResult = z.infer<typeof CleanupScanResultSchema>
export type BuildInfo = z.infer<typeof BuildInfoSchema>
export type DiagnosticLevel = z.infer<typeof DiagnosticLevelSchema>
export type DiagnosticLogEntry = z.infer<typeof DiagnosticLogEntrySchema>
export type DiagnosticsSnapshot = z.infer<typeof DiagnosticsSnapshotSchema>
export type InstallHistoryEntry = z.infer<typeof InstallHistoryEntrySchema>
export type InstalledAppEntry = z.infer<typeof InstalledAppEntrySchema>
export type InstallQueueEvent = z.infer<typeof InstallQueueEventSchema>
export type InstallQueueItem = z.infer<typeof InstallQueueItemSchema>
export type ReadinessSnapshot = z.infer<typeof ReadinessSnapshotSchema>
export type SettingsState = z.infer<typeof SettingsStateSchema>
export type UninstallResult = z.infer<typeof UninstallResultSchema>
