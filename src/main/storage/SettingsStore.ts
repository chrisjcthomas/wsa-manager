import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  SettingsStateSchema,
  settingsVersion,
  type CleanupHistoryEntry,
  type InstallHistoryEntry,
  type SettingsState
} from '@shared/contracts'

const defaultSettings: SettingsState = {
  version: settingsVersion,
  wizardCompleted: false,
  recentCleanupActions: [],
  recentInstalls: []
}

export class SettingsStore {
  private readonly filePath: string
  private cache: SettingsState

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.cache = this.load()
  }

  get(): SettingsState {
    return this.cache
  }

  setWizardCompleted(value: boolean): SettingsState {
    return this.update({
      wizardCompleted: value
    })
  }

  setAdbPath(adbPath?: string): SettingsState {
    return this.update({
      adbPath,
      wizardCompleted: false
    })
  }

  setManualEndpoint(manualEndpoint?: string): SettingsState {
    return this.update({
      manualEndpoint,
      wizardCompleted: false
    })
  }

  recordInstall(entry: InstallHistoryEntry): SettingsState {
    const recentInstalls = [entry, ...this.cache.recentInstalls.filter((item) => item.packageName !== entry.packageName)].slice(0, 50)
    return this.update({
      recentInstalls
    })
  }

  recordCleanup(entry: CleanupHistoryEntry): SettingsState {
    const recentCleanupActions = [entry, ...this.cache.recentCleanupActions].slice(0, 50)
    return this.update({
      recentCleanupActions
    })
  }

  private update(patch: Partial<SettingsState>): SettingsState {
    this.cache = SettingsStateSchema.parse({
      ...this.cache,
      ...patch
    })

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8')
    return this.cache
  }

  private load(): SettingsState {
    try {
      if (!fs.existsSync(this.filePath)) {
        return defaultSettings
      }

      const raw = fs.readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      return SettingsStateSchema.parse({
        ...defaultSettings,
        ...parsed
      })
    } catch {
      return defaultSettings
    }
  }
}
