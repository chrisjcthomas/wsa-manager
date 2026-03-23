import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CleanupService } from '@main/services/cleanup/CleanupService'

const electronPaths = vi.hoisted(() => ({
  appData: '',
  desktop: '',
  home: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: keyof typeof electronPaths) => electronPaths[name]
  }
}))

describe('CleanupService apply', () => {
  let tempRoot: string
  let settingsStore: { recordCleanup: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wsa-cleanup-'))
    electronPaths.appData = path.join(tempRoot, 'AppData', 'Roaming')
    electronPaths.desktop = path.join(tempRoot, 'Desktop')
    electronPaths.home = tempRoot
    fs.mkdirSync(electronPaths.desktop, { recursive: true })
    settingsStore = {
      recordCleanup: vi.fn()
    }
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('rejects tampered cleanup findings that do not match the latest scan', async () => {
    const service = createService(settingsStore)
    const scannedFinding = createDesktopFinding(path.join(electronPaths.desktop, 'Cinexplore.lnk'))

    ;(service as any).latestScanFindings = new Map([[scannedFinding.id, scannedFinding]])

    const result = await service.apply([
      {
        ...scannedFinding,
        target: path.join(tempRoot, 'DesktopBackup', 'Cinexplore.lnk')
      }
    ])

    expect(result.removed).toHaveLength(0)
    expect(result.failed).toEqual([
      expect.objectContaining({
        findingId: scannedFinding.id,
        reason: expect.stringContaining('latest scan results')
      })
    ])
    expect(settingsStore.recordCleanup).not.toHaveBeenCalled()
  })

  it('removes findings that exactly match the latest scan results', async () => {
    const service = createService(settingsStore)
    const shortcutPath = path.join(electronPaths.desktop, 'Cinexplore.lnk')
    fs.writeFileSync(shortcutPath, 'shortcut', 'utf8')
    const scannedFinding = createDesktopFinding(shortcutPath)

    ;(service as any).latestScanFindings = new Map([[scannedFinding.id, scannedFinding]])

    const result = await service.apply([scannedFinding])

    expect(result.removed).toEqual([scannedFinding])
    expect(result.failed).toHaveLength(0)
    expect(fs.existsSync(shortcutPath)).toBe(false)
    expect(settingsStore.recordCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        packageName: scannedFinding.packageName,
        artifactCount: 1
      })
    )
  })
})

function createService(settingsStore: { recordCleanup: ReturnType<typeof vi.fn> }) {
  return new CleanupService(
    {
      listUserPackages: vi.fn()
    } as any,
    settingsStore as any,
    {
      log: vi.fn()
    } as any
  )
}

function createDesktopFinding(target: string) {
  return {
    id: 'com.fidloo.cinexplore:desktop:0',
    packageName: 'com.fidloo.cinexplore',
    label: 'Cinexplore',
    artifactType: 'desktop_shortcut' as const,
    target,
    locationLabel: 'Desktop',
    detail: path.basename(target),
    selectedByDefault: true
  }
}
