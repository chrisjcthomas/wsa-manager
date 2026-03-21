import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  CleanupActionResultSchema,
  CleanupFindingSchema,
  CleanupScanResultSchema,
  type CleanupActionResult,
  type CleanupFinding,
  type CleanupScanResult
} from '@shared/contracts'
import { deriveLabelFromPackageName } from '@shared/utils/display'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { runPowerShell } from '@main/services/process'
import { SettingsStore } from '@main/storage/SettingsStore'
import { AdbService } from '@main/services/adb/AdbService'
import { buildSearchTokens, isPathWithinRoot, normalizeForSearch } from './helpers'

interface RegistryEntry {
  KeyPath: string
  PackageName: string
  DisplayName?: string
}

interface RegistryClassEntry {
  KeyPath: string
  Name: string
}

export class CleanupService {
  constructor(
    private readonly adbService: AdbService,
    private readonly settingsStore: SettingsStore,
    private readonly diagnostics: DiagnosticsService
  ) {}

  async scan(packageName?: string): Promise<CleanupScanResult> {
    const warnings: string[] = []
    let installedPackages: string[] = []

    try {
      installedPackages = await this.adbService.listUserPackages()
    } catch {
      warnings.push('ADB is unavailable, so ghost cleanup cannot compare Windows entries to Android packages.')
      return CleanupScanResultSchema.parse({
        scannedAt: new Date().toISOString(),
        warnings,
        findings: []
      })
    }

    const installedSet = new Set(installedPackages)
    const uninstallEntries = await this.listUninstallEntries()
    const candidateEntries = uninstallEntries.filter((entry) => {
      if (!entry.PackageName.includes('.')) {
        return false
      }

      if (packageName && entry.PackageName !== packageName) {
        return false
      }

      return !installedSet.has(entry.PackageName)
    })

    const findings: CleanupFinding[] = []
    for (const entry of candidateEntries) {
      const label = entry.DisplayName?.trim() || deriveLabelFromPackageName(entry.PackageName)
      findings.push(
        CleanupFindingSchema.parse({
          id: `${entry.PackageName}:registry_uninstall`,
          packageName: entry.PackageName,
          label,
          artifactType: 'registry_uninstall',
          target: entry.KeyPath,
          locationLabel: 'Windows uninstall registry',
          detail: `Uninstall entry remains registered for ${entry.PackageName}.`,
          selectedByDefault: true
        })
      )

      const classEntries = await this.listClassEntries(entry.PackageName, label)
      classEntries.forEach((classEntry, index) => {
        findings.push(
          CleanupFindingSchema.parse({
            id: `${entry.PackageName}:registry_class:${index}`,
            packageName: entry.PackageName,
            label,
            artifactType: 'registry_class',
            target: classEntry.KeyPath,
            locationLabel: 'Windows Classes registry',
            detail: `Registry class entry ${classEntry.Name} still references the app.`,
            selectedByDefault: true
          })
        )
      })

      this.findShortcutArtifacts(this.getStartMenuRoot(), entry.PackageName, label).forEach((artifact, index) => {
        findings.push(
          CleanupFindingSchema.parse({
            id: `${entry.PackageName}:start_menu:${index}`,
            packageName: entry.PackageName,
            label,
            artifactType: 'start_menu_shortcut',
            target: artifact,
            locationLabel: 'Start Menu',
            detail: path.basename(artifact),
            selectedByDefault: true
          })
        )
      })

      this.findShortcutArtifacts(app.getPath('desktop'), entry.PackageName, label).forEach((artifact, index) => {
        findings.push(
          CleanupFindingSchema.parse({
            id: `${entry.PackageName}:desktop:${index}`,
            packageName: entry.PackageName,
            label,
            artifactType: 'desktop_shortcut',
            target: artifact,
            locationLabel: 'Desktop',
            detail: path.basename(artifact),
            selectedByDefault: true
          })
        )
      })

      this.findIconArtifacts(entry.PackageName).forEach((artifact, index) => {
        findings.push(
          CleanupFindingSchema.parse({
            id: `${entry.PackageName}:icon:${index}`,
            packageName: entry.PackageName,
            label,
            artifactType: 'icon_cache',
            target: artifact,
            locationLabel: 'WSA LocalState',
            detail: path.basename(artifact),
            selectedByDefault: true
          })
        )
      })
    }

    this.diagnostics.log('info', 'cleanup', `Cleanup scan found ${findings.length} artifact(s)`)
    return CleanupScanResultSchema.parse({
      scannedAt: new Date().toISOString(),
      warnings,
      findings
    })
  }

  async apply(findings: CleanupFinding[]): Promise<CleanupActionResult> {
    const validated = findings.map((finding) => CleanupFindingSchema.parse(finding))
    const removed: CleanupFinding[] = []
    const failed: CleanupActionResult['failed'] = []

    for (const finding of validated) {
      try {
        await this.removeArtifact(finding)
        removed.push(finding)
      } catch (error) {
        failed.push({
          findingId: finding.id,
          target: finding.target,
          reason: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const removedByPackage = new Map<string, number>()
    removed.forEach((finding) => {
      removedByPackage.set(finding.packageName, (removedByPackage.get(finding.packageName) ?? 0) + 1)
    })

    for (const [packageName, artifactCount] of removedByPackage.entries()) {
      this.settingsStore.recordCleanup({
        packageName,
        artifactCount,
        completedAt: new Date().toISOString()
      })
    }

    const result = CleanupActionResultSchema.parse({
      requestedCount: validated.length,
      removed,
      failed,
      completedAt: new Date().toISOString()
    })

    this.diagnostics.log(
      failed.length > 0 ? 'warn' : 'success',
      'cleanup',
      `Cleanup removed ${removed.length} artifact(s)${failed.length > 0 ? ` and failed on ${failed.length}` : ''}`
    )

    return result
  }

  private async listUninstallEntries(): Promise<RegistryEntry[]> {
    const script = `$items = Get-ChildItem HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall | ForEach-Object { $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue; [PSCustomObject]@{ KeyPath = $_.Name -replace '^HKEY_CURRENT_USER','HKCU:'; PackageName = $_.PSChildName; DisplayName = $props.DisplayName } }; if ($items) { $items | ConvertTo-Json -Compress }`
    const result = await runPowerShell(script)
    if (!result.stdout.trim()) {
      return []
    }

    const parsed = JSON.parse(result.stdout) as RegistryEntry | RegistryEntry[]
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  private async listClassEntries(packageName: string, label: string): Promise<RegistryClassEntry[]> {
    const escapedPackage = packageName.replace(/'/g, "''")
    const escapedLabel = label.replace(/'/g, "''")
    const script = `$pkg='${escapedPackage}'; $label='${escapedLabel}'; $items=@(); $exact = Get-Item -LiteralPath "HKCU:\\Software\\Classes\\$pkg" -ErrorAction SilentlyContinue; if ($exact) { $items += [PSCustomObject]@{ KeyPath=$exact.Name -replace '^HKEY_CURRENT_USER','HKCU:'; Name=$exact.PSChildName } }; Get-ChildItem HKCU:\\Software\\Classes | Where-Object { $_.PSChildName -like 'wsa.*' } | ForEach-Object { $props = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue | ConvertTo-Json -Compress -Depth 4); if ($props -match [regex]::Escape($pkg) -or $props -match [regex]::Escape($label)) { $items += [PSCustomObject]@{ KeyPath=$_.Name -replace '^HKEY_CURRENT_USER','HKCU:'; Name=$_.PSChildName } } }; if ($items) { $items | Sort-Object KeyPath -Unique | ConvertTo-Json -Compress }`
    const result = await runPowerShell(script, 45_000)
    if (!result.stdout.trim()) {
      return []
    }

    const parsed = JSON.parse(result.stdout) as RegistryClassEntry | RegistryClassEntry[]
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  private findShortcutArtifacts(rootPath: string, packageName: string, label: string): string[] {
    if (!fs.existsSync(rootPath)) {
      return []
    }

    const matches: string[] = []
    const searchTokens = buildSearchTokens(packageName, label)

    const visit = (currentPath: string) => {
      for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
        const nextPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) {
          visit(nextPath)
          continue
        }

        if (path.extname(entry.name).toLowerCase() !== '.lnk') {
          continue
        }

        const normalized = normalizeForSearch(entry.name)
        if (searchTokens.some((token) => normalized.includes(token))) {
          matches.push(nextPath)
        }
      }
    }

    visit(rootPath)
    return matches
  }

  private findIconArtifacts(packageName: string): string[] {
    const localStateRoot = this.getWsaLocalState()
    if (!fs.existsSync(localStateRoot)) {
      return []
    }

    return ['.ico', '.png']
      .map((extension) => path.join(localStateRoot, `${packageName}${extension}`))
      .filter((candidate) => fs.existsSync(candidate))
  }

  private async removeArtifact(finding: CleanupFinding): Promise<void> {
    if (finding.artifactType === 'registry_uninstall' || finding.artifactType === 'registry_class') {
      if (!finding.target.startsWith('HKCU:\\Software\\')) {
        throw new Error('Refused to remove registry key outside HKCU:\\Software')
      }

      const escapedTarget = finding.target.replace(/'/g, "''")
      await runPowerShell(`Remove-Item -LiteralPath '${escapedTarget}' -Recurse -Force`, 30_000)
      return
    }

    const allowedRoots = [this.getStartMenuRoot(), app.getPath('desktop'), this.getWsaLocalState()]
    if (!allowedRoots.some((rootPath) => isPathWithinRoot(finding.target, rootPath))) {
      throw new Error('Refused to remove file outside known cleanup roots')
    }

    fs.rmSync(finding.target, { force: true })
  }

  private getStartMenuRoot(): string {
    return path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  }

  private getWsaLocalState(): string {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(app.getPath('home'), 'AppData', 'Local')
    return path.join(
      localAppData,
      'Packages',
      'MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe',
      'LocalState'
    )
  }
}
