import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWsaManager } from '@renderer/hooks/useWsaManager'

const setupReadiness = {
  checkedAt: '2026-03-21T12:00:00.000Z',
  overallStatus: 'needs_attention',
  wizardCompleted: false,
  needsSetup: true,
  adb: {
    status: 'not_found',
    message: 'adb.exe was not detected.'
  },
  wsa: {
    status: 'sleeping',
    packageName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
    version: '2407.40000.4.0'
  },
  connection: {
    status: 'sleeping',
    checkedEndpoints: ['127.0.0.1:58526'],
    message: 'WSA is sleeping.'
  },
  messages: ['Setup is incomplete.']
} as const

const settings = {
  version: 1,
  wizardCompleted: false,
  adbPath: undefined,
  manualEndpoint: undefined,
  recentInstalls: [],
  recentCleanupActions: []
}

const diagnostics = {
  build: {
    appVersion: '0.1.0',
    buildTimestamp: '2026-03-21T13:31:49.000Z',
    buildLabel: 'v0.1.0 | 2026-03-21 13:31'
  },
  entries: []
}

function HookHarness() {
  const { showSetupWizard, closeSetupWizard, runSetupCheck, openSetupWizard } = useWsaManager()

  return (
    <div>
      <span data-testid="wizard-state">{showSetupWizard ? 'open' : 'closed'}</span>
      <button onClick={closeSetupWizard}>close wizard</button>
      <button onClick={() => void runSetupCheck()}>run setup check</button>
      <button onClick={openSetupWizard}>open wizard</button>
    </div>
  )
}

describe('useWsaManager setup wizard visibility', () => {
  beforeEach(() => {
    window.wsaApi = {
      getSettings: vi.fn().mockResolvedValue(settings),
      getReadiness: vi.fn().mockResolvedValue(setupReadiness),
      runSetupCheck: vi.fn().mockResolvedValue(setupReadiness),
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
  })

  it('does not reopen the setup wizard after the user dismisses it and a failed setup check runs', async () => {
    render(<HookHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('wizard-state')).toHaveTextContent('open')
    })

    fireEvent.click(screen.getByText('close wizard'))
    expect(screen.getByTestId('wizard-state')).toHaveTextContent('closed')

    fireEvent.click(screen.getByText('run setup check'))

    await waitFor(() => {
      expect(window.wsaApi.runSetupCheck).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('wizard-state')).toHaveTextContent('closed')

    fireEvent.click(screen.getByText('open wizard'))
    expect(screen.getByTestId('wizard-state')).toHaveTextContent('open')
  })
})
