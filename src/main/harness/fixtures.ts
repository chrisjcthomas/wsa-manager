import type {
  BuildInfo,
  CleanupActionResult,
  CleanupFinding,
  CleanupScanResult,
  DiagnosticLogEntry,
  DiagnosticsSnapshot,
  InstallQueueEvent,
  InstallQueueItem,
  InstalledAppEntry,
  ReadinessSnapshot,
  SettingsState,
  UninstallResult
} from '@shared/contracts'

export interface HarnessFixtureState {
  name: string
  delays: {
    readinessMs: number
  }
  settings: SettingsState
  readiness: ReadinessSnapshot
  queue: InstallQueueItem[]
  apps: InstalledAppEntry[]
  cleanupScan: CleanupScanResult
  diagnostics: DiagnosticsSnapshot
}

const fixedNow = '2026-03-21T15:00:00.000Z'

function baseSettings(partial?: Partial<SettingsState>): SettingsState {
  return {
    version: 1,
    wizardCompleted: false,
    adbPath: 'C:\\Android\\platform-tools\\adb.exe',
    manualEndpoint: '127.0.0.1:58526',
    recentInstalls: [],
    recentCleanupActions: [],
    ...partial
  }
}

function baseDiagnostics(build: BuildInfo, entries: DiagnosticLogEntry[]): DiagnosticsSnapshot {
  return {
    build,
    entries
  }
}

function buildEmptyQueueFixture(build: BuildInfo, readinessDelayMs = 0): HarnessFixtureState {
  return {
    name: readinessDelayMs > 0 ? 'slow-readiness' : 'baseline',
    delays: {
      readinessMs: readinessDelayMs
    },
    settings: baseSettings({
      wizardCompleted: false,
      recentInstalls: [
        {
          packageName: 'com.example.discord',
          label: 'Discord',
          fileName: 'Discord.apk',
          installedAt: '2026-03-20T18:10:00.000Z'
        }
      ]
    }),
    readiness: {
      checkedAt: fixedNow,
      overallStatus: 'needs_attention',
      wizardCompleted: false,
      needsSetup: true,
      adb: {
        status: 'ready',
        path: 'C:\\Android\\platform-tools\\adb.exe',
        version: '1.0.41',
        source: 'saved'
      },
      wsa: {
        status: 'sleeping',
        packageName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
        packageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
        version: '2407.40000.4.0',
        installLocation: 'C:\\Program Files\\WindowsSubsystemForAndroid',
        message: 'WSA is currently sleeping.'
      },
      connection: {
        status: 'sleeping',
        checkedEndpoints: ['127.0.0.1:58526'],
        message: 'Wake the subsystem and try again.'
      },
      messages: [
        'WSA is installed but sleeping.',
        'ADB was found and is ready to connect once WSA wakes.'
      ]
    },
    queue: [],
    apps: [
      {
        packageName: 'com.example.discord',
        label: 'Discord',
        labelSource: 'history',
        lastInstalledAt: '2026-03-20T18:10:00.000Z',
        status: 'idle',
        sizeLabel: 'Installed recently',
        iconKind: 'placeholder'
      }
    ],
    cleanupScan: {
      scannedAt: fixedNow,
      warnings: [],
      findings: [
        {
          id: 'cleanup-shortcut-discord',
          packageName: 'com.example.discord',
          label: 'Discord',
          artifactType: 'start_menu_shortcut',
          target: 'C:\\Users\\cobek\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Discord.lnk',
          locationLabel: 'Start menu',
          detail: 'Shortcut still points to an uninstalled WSA package.',
          selectedByDefault: true
        }
      ]
    },
    diagnostics: baseDiagnostics(build, [
      {
        id: 'diag-baseline-1',
        timestamp: fixedNow,
        level: 'info',
        source: 'app',
        message: 'Harness fixture booted',
        detail: readinessDelayMs > 0 ? 'Using delayed readiness response.' : 'Using setup-incomplete baseline fixture.'
      }
    ])
  }
}

function buildQueueFixture(build: BuildInfo): HarnessFixtureState {
  return {
    name: 'queue-populated',
    delays: {
      readinessMs: 0
    },
    settings: baseSettings({
      wizardCompleted: true,
      recentInstalls: [
        {
          packageName: 'com.discord',
          label: 'Discord',
          fileName: 'Discord.apk',
          installedAt: '2026-03-20T18:10:00.000Z'
        },
        {
          packageName: 'com.spotify.music',
          label: 'Spotify',
          fileName: 'Spotify.apk',
          installedAt: '2026-03-21T12:10:00.000Z'
        }
      ]
    }),
    readiness: {
      checkedAt: fixedNow,
      overallStatus: 'ready',
      wizardCompleted: true,
      needsSetup: false,
      adb: {
        status: 'ready',
        path: 'C:\\Android\\platform-tools\\adb.exe',
        version: '1.0.41',
        source: 'saved'
      },
      wsa: {
        status: 'ready',
        packageName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
        packageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
        version: '2407.40000.4.0',
        installLocation: 'C:\\Program Files\\WindowsSubsystemForAndroid'
      },
      connection: {
        status: 'connected',
        endpoint: '127.0.0.1:58526',
        checkedEndpoints: ['127.0.0.1:58526'],
        message: 'Connected to WSA.'
      },
      messages: ['Connected to WSA at 127.0.0.1:58526.']
    },
    queue: [
      {
        id: 'queue-spotify',
        filePath: 'C:\\Fixtures\\Spotify.apk',
        fileName: 'Spotify.apk',
        displayName: 'Spotify',
        sizeBytes: 44100000,
        state: 'installing',
        progress: 68,
        packageName: 'com.spotify.music',
        createdAt: fixedNow,
        updatedAt: fixedNow
      },
      {
        id: 'queue-discord',
        filePath: 'C:\\Fixtures\\Discord.apk',
        fileName: 'Discord.apk',
        displayName: 'Discord',
        sizeBytes: 31200000,
        state: 'installed',
        progress: 100,
        packageName: 'com.discord',
        createdAt: fixedNow,
        updatedAt: fixedNow
      },
      {
        id: 'queue-instagram',
        filePath: 'C:\\Fixtures\\Instagram.apk',
        fileName: 'Instagram.apk',
        displayName: 'Instagram',
        sizeBytes: 53800000,
        state: 'queued',
        progress: 12,
        createdAt: fixedNow,
        updatedAt: fixedNow
      }
    ],
    apps: [
      {
        packageName: 'com.discord',
        label: 'Discord',
        labelSource: 'history',
        lastInstalledAt: '2026-03-20T18:10:00.000Z',
        status: 'idle',
        sizeLabel: 'Installed recently',
        iconKind: 'placeholder'
      },
      {
        packageName: 'com.spotify.music',
        label: 'Spotify',
        labelSource: 'history',
        lastInstalledAt: '2026-03-21T12:10:00.000Z',
        status: 'idle',
        sizeLabel: 'Installed recently',
        iconKind: 'placeholder'
      }
    ],
    cleanupScan: {
      scannedAt: fixedNow,
      warnings: [],
      findings: [
        {
          id: 'cleanup-discord-shortcut',
          packageName: 'com.discord',
          label: 'Discord',
          artifactType: 'desktop_shortcut',
          target: 'C:\\Users\\cobek\\Desktop\\Discord.lnk',
          locationLabel: 'Desktop',
          detail: 'Desktop shortcut can be removed after uninstall.',
          selectedByDefault: true
        },
        {
          id: 'cleanup-discord-icon-cache',
          packageName: 'com.discord',
          label: 'Discord',
          artifactType: 'icon_cache',
          target: 'C:\\Users\\cobek\\AppData\\Local\\Packages\\WSA\\LocalState\\Icons\\discord.png',
          locationLabel: 'WSA LocalState',
          detail: 'Icon cache file is safe to delete.',
          selectedByDefault: true
        }
      ]
    },
    diagnostics: baseDiagnostics(build, [
      {
        id: 'diag-queue-1',
        timestamp: fixedNow,
        level: 'success',
        source: 'wsa',
        message: 'Connected to WSA at 127.0.0.1:58526'
      },
      {
        id: 'diag-queue-2',
        timestamp: '2026-03-21T15:00:10.000Z',
        level: 'info',
        source: 'queue',
        message: 'Spotify.apk is installing',
        detail: 'Progress 68%'
      }
    ])
  }
}

export function createHarnessFixture(name: string | undefined, build: BuildInfo): HarnessFixtureState {
  if (name === 'slow-readiness') {
    return buildEmptyQueueFixture(build, 13_000)
  }

  if (name === 'queue-populated') {
    return buildQueueFixture(build)
  }

  return buildEmptyQueueFixture(build)
}

export function buildCleanupActionResult(findings: CleanupFinding[]): CleanupActionResult {
  return {
    requestedCount: findings.length,
    removed: findings,
    failed: [],
    completedAt: fixedNow
  }
}

export function buildQueueEvent(items: InstallQueueItem[]): InstallQueueEvent {
  return {
    type: 'updated',
    items
  }
}

export function buildUninstallResult(packageName: string, cleanupScan: CleanupScanResult): UninstallResult {
  return {
    packageName,
    removed: true,
    cleanupScan,
    message: `Removed ${packageName} from the harness fixture.`
  }
}

