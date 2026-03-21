import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerHarnessIpcHandlers } from '@main/harness/registerHarnessIpc'
import { registerIpcHandlers } from '@main/ipc/registerIpc'
import { AdbService } from '@main/services/adb/AdbService'
import { CatalogService } from '@main/services/catalog/CatalogService'
import { CleanupService } from '@main/services/cleanup/CleanupService'
import { DiagnosticsService } from '@main/services/diagnostics/DiagnosticsService'
import { WsaService } from '@main/services/wsa/WsaService'
import { SettingsStore } from '@main/storage/SettingsStore'
import { InstallQueueService } from '@main/tasks/InstallQueueService'
import { type BuildInfo } from '@shared/contracts'

function publishToWindows(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, payload)
  })
}

function resolveBuildInfo(): BuildInfo {
  const candidatePaths = [path.join(app.getAppPath(), 'out', 'build-info.json'), path.join(app.getAppPath(), 'build-info.json')]

  for (const candidatePath of candidatePaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        return JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as BuildInfo
      }
    } catch {
      // Fall through to the runtime fallback below.
    }
  }

  const appVersion = app.getVersion()
  const buildTimestamp = new Date().toISOString()
  return {
    appVersion,
    buildTimestamp,
    buildLabel: `v${appVersion} | ${buildTimestamp.slice(0, 16).replace('T', ' ')}`
  }
}

function getSwitchValue(name: string): string | undefined {
  try {
    const value = app.commandLine.getSwitchValue(name)
    return value || undefined
  } catch {
    return undefined
  }
}

function getNumericSwitchValue(name: string, fallback: number): number {
  const rawValue = getSwitchValue(name)
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function getHarnessFixtureName(): string | undefined {
  return process.env.WSA_MANAGER_FIXTURE || getSwitchValue('harness-fixture')
}

async function createWindow(): Promise<void> {
  const preloadEntry = path.join(__dirname, '../preload/index.mjs')
  const mainWindow = new BrowserWindow({
    width: getNumericSwitchValue('window-width', 1400),
    height: getNumericSwitchValue('window-height', 920),
    minWidth: 920,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#232723',
    webPreferences: {
      preload: preloadEntry,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const buildInfo = resolveBuildInfo()
  const harnessFixtureName = getHarnessFixtureName()

  if (harnessFixtureName) {
    registerHarnessIpcHandlers(harnessFixtureName, buildInfo, publishToWindows)
  } else {
    const settingsStore = new SettingsStore()
    const diagnostics = new DiagnosticsService(buildInfo)
    diagnostics.setPublisher(publishToWindows)
    const adbService = new AdbService(settingsStore, diagnostics)
    const wsaService = new WsaService(settingsStore, adbService, diagnostics)
    const catalog = new CatalogService(adbService, settingsStore, diagnostics)
    const cleanup = new CleanupService(adbService, settingsStore, diagnostics)
    const installQueue = new InstallQueueService(adbService, wsaService, settingsStore, diagnostics)
    installQueue.setPublisher(publishToWindows)

    registerIpcHandlers({
      settingsStore,
      diagnostics,
      installQueue,
      catalog,
      cleanup,
      wsa: wsaService
    })

    diagnostics.log('info', 'app', 'WSA Manager started')
  }

  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})
