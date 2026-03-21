import { type InstalledAppEntry } from '@shared/contracts'
import { deriveLabelFromPackageName } from '@shared/utils/display'
import { AdbService } from '@main/services/adb/AdbService'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { SettingsStore } from '@main/storage/SettingsStore'

export class CatalogService {
  constructor(
    public readonly adbService: AdbService,
    private readonly settingsStore: SettingsStore,
    private readonly diagnostics: DiagnosticsService
  ) {}

  async listInstalledApps(): Promise<InstalledAppEntry[]> {
    const settings = this.settingsStore.get()
    const historyByPackage = new Map(settings.recentInstalls.map((entry) => [entry.packageName, entry]))
    const packages = await this.adbService.listUserPackages()

    const entries = packages.map((packageName) => {
      const history = historyByPackage.get(packageName)

      return {
        packageName,
        label: history?.label ?? deriveLabelFromPackageName(packageName),
        labelSource: history ? ('history' as const) : ('derived' as const),
        lastInstalledAt: history?.installedAt,
        status: 'idle' as const,
        sizeLabel: history ? `Added ${new Date(history.installedAt).toLocaleDateString()}` : 'Unknown size',
        iconKind: 'placeholder' as const
      }
    })

    entries.sort((left, right) => left.label.localeCompare(right.label))
    this.diagnostics.log('info', 'catalog', `Loaded ${entries.length} installed packages`)
    return entries
  }
}
