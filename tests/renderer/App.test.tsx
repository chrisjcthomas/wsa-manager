import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@renderer/App'

const readiness = {
  checkedAt: '2026-03-21T12:00:00.000Z',
  overallStatus: 'ready',
  wizardCompleted: true,
  needsSetup: false,
  adb: {
    status: 'ready',
    path: 'C:\\Android\\platform-tools\\adb.exe',
    version: '1.0.41',
    source: 'ANDROID_SDK_ROOT'
  },
  wsa: {
    status: 'ready',
    packageName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
    packageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
    version: '2407.40000.4.0',
    installLocation: 'C:\\WSA'
  },
  connection: {
    status: 'connected',
    endpoint: '127.0.0.1:58526',
    checkedEndpoints: ['127.0.0.1:58526']
  },
  messages: []
} as const

const settings = {
  version: 1,
  wizardCompleted: true,
  adbPath: 'C:\\Android\\platform-tools\\adb.exe',
  manualEndpoint: undefined,
  recentInstalls: [],
  recentCleanupActions: []
}

const diagnostics = {
  build: {
    appVersion: '0.1.0',
    buildTimestamp: '2026-03-21T13:31:49.000Z',
    buildLabel: 'v0.1.0 • 2026-03-21 13:31'
  },
  entries: [
    {
      id: 'diag-1',
      timestamp: '2026-03-21T13:31:49.000Z',
      level: 'info',
      source: 'app',
      message: 'WSA Manager started'
    }
  ]
}

function installApiMocks(options?: {
  readinessSnapshot?: typeof readiness
  runSetupSnapshot?: typeof readiness
}) {
  const readinessSnapshot = options?.readinessSnapshot ?? readiness
  const runSetupSnapshot = options?.runSetupSnapshot ?? readinessSnapshot

  window.wsaApi = {
    getSettings: vi.fn().mockResolvedValue(settings),
    getReadiness: vi.fn().mockResolvedValue(readinessSnapshot),
    runSetupCheck: vi.fn().mockResolvedValue(runSetupSnapshot),
    saveAdbPath: vi.fn().mockResolvedValue(settings),
    setManualEndpoint: vi.fn().mockResolvedValue(settings),
    pickAdbPath: vi.fn().mockResolvedValue(undefined),
    pickApkFiles: vi.fn().mockResolvedValue([]),
    enqueueApks: vi.fn().mockResolvedValue([]),
    getInstallQueue: vi.fn().mockResolvedValue([]),
    subscribeQueueEvents: vi.fn().mockReturnValue(() => {}),
    listInstalledApps: vi.fn().mockResolvedValue([]),
    uninstallApp: vi.fn(),
    scanCleanup: vi.fn(),
    applyCleanup: vi.fn(),
    getDiagnostics: vi.fn().mockResolvedValue(diagnostics),
    clearDiagnostics: vi.fn().mockResolvedValue(undefined),
    subscribeDiagnostics: vi.fn().mockReturnValue(() => {}),
    wakeWsa: vi.fn().mockResolvedValue(true)
  } as any
}

async function renderAppAt(width: number) {
  window.innerWidth = width
  render(<App />)
  await screen.findByRole('heading', { name: 'Dashboard' })
}

describe('WSA Manager app shell', () => {
  beforeEach(() => {
    installApiMocks()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400
    })
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('renders the desktop shell by default', async () => {
    await renderAppAt(1400)

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-layout', 'desktop')
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-compact', 'false')
    expect(screen.getByText('Installed Apps')).toBeInTheDocument()
  })

  it('switches into compact and narrow layout modes on resize', async () => {
    await renderAppAt(1400)

    window.innerWidth = 1100
    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(screen.getByTestId('app-shell')).toHaveAttribute('data-layout', 'compact')
    })
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-compact', 'true')
    expect(screen.queryByText('Installed Apps')).not.toBeInTheDocument()

    window.innerWidth = 960
    fireEvent(window, new Event('resize'))

    await waitFor(() => {
      expect(screen.getByTestId('app-shell')).toHaveAttribute('data-layout', 'narrow')
    })
  })

  it('shows build provenance in diagnostics in narrow mode', async () => {
    await renderAppAt(960)

    fireEvent.click(screen.getByLabelText('Diagnostics'))
    expect(await screen.findByTestId('diagnostics-build-label')).toHaveTextContent('v0.1.0')
  })
})
