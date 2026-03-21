import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { WsaService } from '@main/services/wsa/WsaService'
import { runPowerShell } from '@main/services/process'

vi.mock('@main/services/process', () => ({
  runCommand: vi.fn(),
  runPowerShell: vi.fn()
}))

describe('WsaService readiness', () => {
  const diagnostics = new DiagnosticsService({
    appVersion: '0.1.0',
    buildTimestamp: '2026-03-21T00:00:00.000Z',
    buildLabel: 'v0.1.0 • 2026-03-21 00:00'
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns sleeping quickly when adb connect does not respond', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(runPowerShell).mockResolvedValue({
        stdout: JSON.stringify({
          Name: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
          PackageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
          InstallLocation: 'C:\\WSA',
          Version: '2407.40000.4.0'
        }),
        stderr: '',
        exitCode: 0
      })

      const settingsStore = {
        setWizardCompleted: vi.fn(),
        get: () => ({
          version: 1,
          wizardCompleted: false,
          recentInstalls: [],
          recentCleanupActions: []
        })
      } as any

      const adbService = {
        resolveAdb: vi.fn().mockResolvedValue({
          path: 'C:\\Android\\platform-tools\\adb.exe',
          version: '1.0.41',
          source: 'ANDROID_SDK_ROOT'
        }),
        ensureServer: vi.fn().mockResolvedValue({
          path: 'C:\\Android\\platform-tools\\adb.exe',
          version: '1.0.41',
          source: 'ANDROID_SDK_ROOT'
        }),
        listDevices: vi.fn().mockResolvedValue([]),
        connect: vi.fn().mockReturnValue(new Promise(() => {}))
      } as any

      const service = new WsaService(settingsStore, adbService, diagnostics)
      const readinessPromise = service.getReadinessSnapshot()

      await vi.advanceTimersByTimeAsync(5_000)
      const snapshot = await readinessPromise

      expect(snapshot.overallStatus).toBe('needs_attention')
      expect(snapshot.connection.status).toBe('sleeping')
      expect(snapshot.connection.message).toContain('Wake the subsystem')
      expect(adbService.connect).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports ready immediately when an active loopback device already exists', async () => {
    vi.mocked(runPowerShell).mockResolvedValue({
      stdout: JSON.stringify({
        Name: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
        PackageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
        InstallLocation: 'C:\\WSA',
        Version: '2407.40000.4.0'
      }),
      stderr: '',
      exitCode: 0
    })

    const settingsStore = {
      setWizardCompleted: vi.fn(),
      get: () => ({
        version: 1,
        wizardCompleted: false,
        recentInstalls: [],
        recentCleanupActions: []
      })
    } as any

    const adbService = {
      resolveAdb: vi.fn().mockResolvedValue({
        path: 'C:\\Android\\platform-tools\\adb.exe',
        version: '1.0.41',
        source: 'ANDROID_SDK_ROOT'
      }),
      ensureServer: vi.fn().mockResolvedValue({
        path: 'C:\\Android\\platform-tools\\adb.exe',
        version: '1.0.41',
        source: 'ANDROID_SDK_ROOT'
      }),
      listDevices: vi.fn().mockResolvedValue([
        { serial: '127.0.0.1:58526', status: 'device' }
      ]),
      connect: vi.fn()
    } as any

    const service = new WsaService(settingsStore, adbService, diagnostics)
    const snapshot = await service.getReadinessSnapshot()

    expect(snapshot.overallStatus).toBe('ready')
    expect(snapshot.connection.status).toBe('connected')
    expect(snapshot.connection.endpoint).toBe('127.0.0.1:58526')
    expect(adbService.connect).not.toHaveBeenCalled()
  })

  it('surfaces adb discovery timeouts without failing the whole snapshot', async () => {
    vi.useFakeTimers()

    try {
      vi.mocked(runPowerShell).mockResolvedValue({
        stdout: JSON.stringify({
          Name: 'MicrosoftCorporationII.WindowsSubsystemForAndroid',
          PackageFullName: 'MicrosoftCorporationII.WindowsSubsystemForAndroid_2407.40000.4.0_x64__8wekyb3d8bbwe',
          InstallLocation: 'C:\\WSA',
          Version: '2407.40000.4.0'
        }),
        stderr: '',
        exitCode: 0
      })

      const settingsStore = {
        setWizardCompleted: vi.fn(),
        get: () => ({
          version: 1,
          wizardCompleted: false,
          recentInstalls: [],
          recentCleanupActions: []
        })
      } as any

      const adbService = {
        resolveAdb: vi.fn(() => new Promise(() => {})),
        ensureServer: vi.fn(),
        listDevices: vi.fn(),
        connect: vi.fn()
      } as any

      const service = new WsaService(settingsStore, adbService, diagnostics)
      const readinessPromise = service.getReadinessSnapshot()

      await vi.advanceTimersByTimeAsync(5_000)
      const snapshot = await readinessPromise

      expect(snapshot.overallStatus).toBe('needs_attention')
      expect(snapshot.adb.status).toBe('not_found')
      expect(snapshot.messages.some((message) => message.includes('ADB discovery timed out'))).toBe(true)
      expect(snapshot.messages.some((message) => message.includes('ADB was not detected'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps install-style defaults when no fast-probe options are provided', async () => {
    const settingsStore = {
      setWizardCompleted: vi.fn(),
      get: () => ({
        version: 1,
        wizardCompleted: false,
        recentInstalls: [],
        recentCleanupActions: []
      })
    } as any

    const adbService = {
      listDevices: vi.fn().mockResolvedValue([]),
      connect: vi.fn().mockResolvedValue({
        success: false,
        message: 'connection refused'
      })
    } as any

    const service = new WsaService(settingsStore, adbService, diagnostics)
    const result = await service.connectToBestEndpoint()

    expect(result.connected).toBe(false)
    expect(adbService.listDevices).toHaveBeenCalledWith(30_000)
    expect(adbService.connect).toHaveBeenCalledWith('127.0.0.1:58526', 20_000)
  })

  it('continues to later endpoints after an earlier candidate times out', async () => {
    vi.useFakeTimers()

    try {
      const settingsStore = {
        setWizardCompleted: vi.fn(),
        get: () => ({
          version: 1,
          wizardCompleted: false,
          recentInstalls: [],
          recentCleanupActions: []
        })
      } as any

      const adbService = {
        listDevices: vi.fn().mockResolvedValue([]),
        connect: vi
          .fn()
          .mockImplementationOnce(() => new Promise(() => {}))
          .mockResolvedValueOnce({
            success: true,
            message: 'connected to 127.0.0.1:58527'
          })
      } as any

      const service = new WsaService(settingsStore, adbService, diagnostics)
      const connectionPromise = service.connectToBestEndpoint('127.0.0.1:58527', {
        connectTimeoutMs: 1_000,
        devicesTimeoutMs: 1_000
      })

      await vi.advanceTimersByTimeAsync(1_100)
      const result = await connectionPromise

      expect(result.connected).toBe(true)
      expect(result.endpoint).toBe('127.0.0.1:58527')
      expect(result.checkedEndpoints).toEqual(['127.0.0.1:58526', '127.0.0.1:58527'])
      expect(adbService.connect).toHaveBeenNthCalledWith(1, '127.0.0.1:58526', 1_000)
      expect(adbService.connect).toHaveBeenNthCalledWith(2, '127.0.0.1:58527', 1_000)
    } finally {
      vi.useRealTimers()
    }
  })
})
