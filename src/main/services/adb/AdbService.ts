import fs from 'node:fs'
import path from 'node:path'
import { runCommand } from '@main/services/process'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { SettingsStore } from '@main/storage/SettingsStore'
import { extractInstallError, parseAdbDevicesOutput, parseAdbVersion, parsePackageListOutput, type ParsedDevice } from './parsers'

export interface ResolvedAdb {
  path: string
  version: string
  source: string
}

export class AdbService {
  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly diagnostics: DiagnosticsService
  ) {}

  async resolveAdb(timeoutMs = 30_000): Promise<ResolvedAdb | undefined> {
    const candidates = await this.collectCandidates(timeoutMs)

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate.path)) {
        continue
      }

      try {
        const result = await runCommand(candidate.path, ['version'], timeoutMs)
        const version = parseAdbVersion(result.stdout) ?? parseAdbVersion(result.stderr)
        if (result.exitCode === 0 && version) {
          return {
            path: candidate.path,
            version,
            source: candidate.source
          }
        }
      } catch {
        continue
      }
    }

    return undefined
  }

  async ensureServer(timeoutMs = 15_000): Promise<ResolvedAdb> {
    const adb = await this.requireAdb(timeoutMs)
    await this.execAdb(['start-server'], timeoutMs)
    return adb
  }

  async listDevices(timeoutMs = 30_000): Promise<ParsedDevice[]> {
    const result = await this.execAdb(['devices'], timeoutMs)
    return parseAdbDevicesOutput(result.stdout)
  }

  async connect(endpoint: string, timeoutMs = 20_000): Promise<{ success: boolean; message: string }> {
    const result = await this.execAdb(['connect', endpoint], timeoutMs)
    const message = `${result.stdout}\n${result.stderr}`.trim()
    const success = /connected to|already connected to/i.test(message) && result.exitCode === 0
    return {
      success,
      message
    }
  }

  async installApk(apkPath: string, timeoutMs = 120_000): Promise<{ success: boolean; message: string }> {
    const result = await this.execAdb(['install', '-r', apkPath], timeoutMs)
    const message = `${result.stdout}\n${result.stderr}`.trim()
    return {
      success: result.exitCode === 0 && /success/i.test(message),
      message: result.exitCode === 0 ? message || 'Success' : extractInstallError(result.stdout, result.stderr)
    }
  }

  async uninstallPackage(packageName: string, timeoutMs = 60_000): Promise<{ success: boolean; message: string }> {
    const result = await this.execAdb(['uninstall', packageName], timeoutMs)
    const message = `${result.stdout}\n${result.stderr}`.trim()
    return {
      success: result.exitCode === 0 && /success/i.test(message),
      message: message || (result.exitCode === 0 ? 'Success' : 'Uninstall failed')
    }
  }

  async listUserPackages(timeoutMs = 30_000): Promise<string[]> {
    const result = await this.execAdb(['shell', 'pm', 'list', 'packages', '-3'], timeoutMs)
    return parsePackageListOutput(result.stdout)
  }

  async listAllPackages(timeoutMs = 30_000): Promise<string[]> {
    const result = await this.execAdb(['shell', 'pm', 'list', 'packages'], timeoutMs)
    return parsePackageListOutput(result.stdout)
  }

  private async execAdb(args: string[], timeoutMs = 30_000) {
    const adb = await this.requireAdb(timeoutMs)
    const result = await runCommand(adb.path, args, timeoutMs)

    if (result.exitCode !== 0) {
      this.diagnostics.log('warn', 'adb', `ADB command failed: ${args.join(' ')}`, `${result.stdout}\n${result.stderr}`.trim())
    }

    return result
  }

  private async requireAdb(timeoutMs = 30_000): Promise<ResolvedAdb> {
    const adb = await this.resolveAdb(timeoutMs)
    if (!adb) {
      this.diagnostics.log('error', 'adb', 'ADB executable not found')
      throw new Error('ADB executable not found')
    }

    return adb
  }

  private async collectCandidates(timeoutMs = 30_000): Promise<Array<{ path: string; source: string }>> {
    const settings = this.settingsStore.get()
    const candidates: Array<{ path: string; source: string }> = []
    const seen = new Set<string>()

    const addCandidate = (candidatePath: string | undefined, source: string) => {
      if (!candidatePath) {
        return
      }

      const normalized = path.normalize(candidatePath)
      if (seen.has(normalized)) {
        return
      }

      seen.add(normalized)
      candidates.push({
        path: normalized,
        source
      })
    }

    addCandidate(settings.adbPath, 'saved')
    addCandidate(process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe') : undefined, 'ANDROID_SDK_ROOT')
    addCandidate(process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : undefined, 'ANDROID_HOME')
    addCandidate(process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe') : undefined, 'LOCALAPPDATA')

    try {
      const result = await runCommand('where.exe', ['adb'], timeoutMs)
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((candidatePath) => addCandidate(candidatePath, 'PATH'))
    } catch {
      // Ignore PATH lookup failures.
    }

    return candidates
  }
}
