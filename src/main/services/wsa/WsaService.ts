import { ReadinessSnapshotSchema, type ReadinessSnapshot } from '@shared/contracts'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { runCommand, runPowerShell } from '@main/services/process'
import { SettingsStore } from '@main/storage/SettingsStore'
import { AdbService } from '@main/services/adb/AdbService'

interface WsaPackageInfo {
  Name: string
  PackageFullName: string
  InstallLocation: string
  Version: string
}

const READINESS_TIMEOUTS = {
  adbDiscoveryMs: 5_000,
  startServerMs: 4_000,
  packageLookupMs: 4_000,
  listDevicesMs: 2_500,
  connectMs: 2_500
} as const

const DEFAULT_CONNECTION_TIMEOUTS = {
  listDevicesMs: 30_000,
  connectMs: 20_000
} as const

export class WsaService {
  private readonly appId = 'MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe!SettingsApp'

  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly adbService: AdbService,
    private readonly diagnostics: DiagnosticsService
  ) {}

  async wake(): Promise<boolean> {
    try {
      await runCommand('explorer.exe', [`shell:AppsFolder\\${this.appId}`], 15_000)
      this.diagnostics.log('info', 'wsa', 'Wake signal sent to WSA settings app')
      return true
    } catch (error) {
      this.diagnostics.log('error', 'wsa', 'Failed to wake WSA', error instanceof Error ? error.message : String(error))
      return false
    }
  }

  async getReadinessSnapshot(): Promise<ReadinessSnapshot> {
    const settings = this.settingsStore.get()
    const messages: string[] = []
    const checkedEndpoints: string[] = []
    const [wsaPackageResult, adbResult] = await Promise.allSettled([
      this.withTimeout(this.getInstalledPackage(), READINESS_TIMEOUTS.packageLookupMs, 'WSA package lookup'),
      this.withTimeout(this.adbService.resolveAdb(READINESS_TIMEOUTS.adbDiscoveryMs), READINESS_TIMEOUTS.adbDiscoveryMs, 'ADB discovery')
    ])

    const wsaPackage = wsaPackageResult.status === 'fulfilled' ? wsaPackageResult.value : undefined
    const adb = adbResult.status === 'fulfilled' ? adbResult.value : undefined
    const probeMessages: string[] = []

    if (wsaPackageResult.status === 'rejected') {
      probeMessages.push(wsaPackageResult.reason instanceof Error ? wsaPackageResult.reason.message : String(wsaPackageResult.reason))
    }

    if (adbResult.status === 'rejected') {
      probeMessages.push(adbResult.reason instanceof Error ? adbResult.reason.message : String(adbResult.reason))
    }

    const snapshot: ReadinessSnapshot = {
      checkedAt: new Date().toISOString(),
      overallStatus: 'needs_attention',
      wizardCompleted: settings.wizardCompleted,
      needsSetup: true,
      adb: adb
        ? {
            status: 'ready',
            path: adb.path,
            version: adb.version,
            source: adb.source
          }
        : {
            status: 'not_found',
            message: 'Install or point WSA Manager to adb.exe.'
          },
      wsa: wsaPackage
        ? {
            status: 'sleeping',
            packageName: wsaPackage.Name,
            packageFullName: wsaPackage.PackageFullName,
            version: wsaPackage.Version,
            installLocation: wsaPackage.InstallLocation
          }
        : {
            status: 'not_found',
            message: 'WSA package could not be found.'
          },
      connection: {
        status: !adb ? 'adb_missing' : !wsaPackage ? 'wsa_missing' : 'sleeping',
        checkedEndpoints
      },
      messages
    }

    if (!wsaPackage) {
      messages.push('Windows Subsystem for Android was not detected.')
    }

    if (!adb) {
      messages.push('ADB was not detected. Choose adb.exe or install Android platform-tools.')
    }

    if (probeMessages.length > 0) {
      messages.push(...probeMessages)
    }

    if (wsaPackage && adb) {
      try {
        await this.withTimeout(
          this.adbService.ensureServer(READINESS_TIMEOUTS.startServerMs),
          READINESS_TIMEOUTS.startServerMs,
          'ADB start-server'
        )
        const connection = await this.connectToBestEndpoint(settings.manualEndpoint, {
          connectTimeoutMs: READINESS_TIMEOUTS.connectMs,
          devicesTimeoutMs: READINESS_TIMEOUTS.listDevicesMs
        })
        checkedEndpoints.push(...connection.checkedEndpoints)

        if (connection.endpoint) {
          snapshot.connection.endpoint = connection.endpoint
        }

        if (connection.connected) {
          snapshot.wsa.status = 'ready'
          snapshot.connection.status = 'connected'
          snapshot.connection.message = connection.message
          snapshot.overallStatus = 'ready'
          snapshot.needsSetup = false
          messages.push(`Connected to WSA at ${connection.endpoint}.`)
        } else {
          snapshot.wsa.status = 'sleeping'
          snapshot.connection.status = 'sleeping'
          snapshot.connection.message = connection.message
          messages.push(connection.message || 'WSA appears installed, but it is not accepting ADB connections yet.')
        }
      } catch (error) {
        snapshot.adb.status = 'error'
        snapshot.adb.message = error instanceof Error ? error.message : String(error)
        snapshot.connection.status = 'not_connected'
        messages.push(snapshot.adb.message)
      }
    }

    if (snapshot.overallStatus === 'ready' && !settings.wizardCompleted) {
      this.settingsStore.setWizardCompleted(true)
      snapshot.wizardCompleted = true
    }

    snapshot.needsSetup = snapshot.overallStatus !== 'ready'
    return ReadinessSnapshotSchema.parse(snapshot)
  }

  async connectToBestEndpoint(
    manualEndpoint?: string,
    options?: { connectTimeoutMs?: number; devicesTimeoutMs?: number }
  ): Promise<{
    connected: boolean
    endpoint?: string
    checkedEndpoints: string[]
    message: string
  }> {
    const devicesTimeoutMs = options?.devicesTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUTS.listDevicesMs
    const connectTimeoutMs = options?.connectTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUTS.connectMs
    const devices = await this.withTimeout(
      this.adbService.listDevices(devicesTimeoutMs),
      devicesTimeoutMs,
      'ADB devices listing'
    ).catch(() => [])
    const checkedEndpoints: string[] = []
    let sawTimedOutCandidate = false
    const candidates = [
      '127.0.0.1:58526',
      ...devices.map((device) => device.serial).filter((serial) => /^127\.0\.0\.1:\d+$/.test(serial)),
      ...(manualEndpoint ? [manualEndpoint] : [])
    ].filter((value, index, values) => values.indexOf(value) === index)

    for (const candidate of candidates) {
      checkedEndpoints.push(candidate)

      const existing = devices.find((device) => device.serial === candidate && device.status === 'device')
      if (existing) {
        return {
          connected: true,
          endpoint: candidate,
          checkedEndpoints,
          message: 'ADB already has an active WSA device.'
        }
      }

      try {
        const result = await this.withTimeout(
          this.adbService.connect(candidate, connectTimeoutMs),
          connectTimeoutMs,
          `ADB connect ${candidate}`
        )

        if (result.success) {
          this.diagnostics.log('success', 'wsa', `Connected to WSA at ${candidate}`)
          return {
            connected: true,
            endpoint: candidate,
            checkedEndpoints,
            message: result.message
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/timed out/i.test(message)) {
          sawTimedOutCandidate = true
        }
      }
    }

    if (sawTimedOutCandidate) {
      return {
        connected: false,
        checkedEndpoints,
        message: 'WSA is installed, but it is not accepting ADB connections yet. Wake the subsystem and try again.'
      }
    }

    return {
      connected: false,
      checkedEndpoints,
      message: 'Could not connect to WSA. Wake the subsystem and try again.'
    }
  }

  private async getInstalledPackage(): Promise<WsaPackageInfo | undefined> {
    const script = `$pkg = Get-AppxPackage *WindowsSubsystemForAndroid* | Select-Object Name, PackageFullName, InstallLocation, Version; if ($pkg) { $pkg | ConvertTo-Json -Compress }`
    const result = await runPowerShell(script, READINESS_TIMEOUTS.packageLookupMs)

    if (!result.stdout.trim()) {
      return undefined
    }

    try {
      return JSON.parse(result.stdout) as WsaPackageInfo
    } catch {
      return undefined
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`))
      }, timeoutMs)

      void promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
  }
}
