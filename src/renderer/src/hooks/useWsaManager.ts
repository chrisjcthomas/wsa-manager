import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import type {
  CleanupActionResult,
  CleanupFinding,
  CleanupScanResult,
  BuildInfo,
  DiagnosticLogEntry,
  InstallQueueItem,
  InstalledAppEntry,
  ReadinessSnapshot,
  SettingsState,
  UninstallResult
} from '@shared/contracts'

export type ViewId = 'install' | 'apps' | 'cleanup' | 'diag'

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`))
    }, timeoutMs)

    void promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export function useWsaManager() {
  const [activeView, setActiveView] = useState<ViewId>('install')
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null)
  const [queue, setQueue] = useState<InstallQueueItem[]>([])
  const [apps, setApps] = useState<InstalledAppEntry[]>([])
  const [cleanupScan, setCleanupScan] = useState<CleanupScanResult | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticLogEntry[]>([])
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [bootError, setBootError] = useState<string>()
  const [appsError, setAppsError] = useState<string>()
  const [cleanupError, setCleanupError] = useState<string>()
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isReadinessLoading, setIsReadinessLoading] = useState(false)
  const [isSetupBusy, setIsSetupBusy] = useState(false)
  const [isAppsBusy, setIsAppsBusy] = useState(false)
  const [isCleanupBusy, setIsCleanupBusy] = useState(false)
  const [isApplyingCleanup, setIsApplyingCleanup] = useState(false)
  const [uninstallingPackage, setUninstallingPackage] = useState<string>()
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [showWakeModal, setShowWakeModal] = useState(false)
  const [hasAutoOpenedSetupWizard, setHasAutoOpenedSetupWizard] = useState(false)
  const [hasDismissedSetupWizard, setHasDismissedSetupWizard] = useState(false)

  const syncSetupWizardVisibility = useEffectEvent((nextReadiness: ReadinessSnapshot, options?: { allowAutoOpen?: boolean }) => {
    if (!nextReadiness.needsSetup) {
      setShowSetupWizard(false)
      setHasAutoOpenedSetupWizard(false)
      setHasDismissedSetupWizard(false)
      return
    }

    if (options?.allowAutoOpen && !nextReadiness.wizardCompleted && !hasAutoOpenedSetupWizard && !hasDismissedSetupWizard) {
      setShowSetupWizard(true)
      setHasAutoOpenedSetupWizard(true)
    }
  })

  const openSetupWizard = useEffectEvent(() => {
    setHasDismissedSetupWizard(false)
    setShowSetupWizard(true)
  })

  const closeSetupWizard = useEffectEvent(() => {
    setHasDismissedSetupWizard(true)
    setShowSetupWizard(false)
  })

  const refreshApps = useEffectEvent(async () => {
    setIsAppsBusy(true)
    try {
      const nextApps = await window.wsaApi.listInstalledApps()
      setAppsError(undefined)
      startTransition(() => {
        setApps(nextApps)
      })
    } catch (error) {
      setAppsError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsAppsBusy(false)
    }
  })

  const refreshReadiness = useEffectEvent(async () => {
    setIsReadinessLoading(true)
    try {
      const nextReadiness = await withTimeout(window.wsaApi.getReadiness(), 12_000, 'Readiness check')
      startTransition(() => {
        setReadiness(nextReadiness)
        setBootError(undefined)
      })
      syncSetupWizardVisibility(nextReadiness, { allowAutoOpen: true })

      if (nextReadiness.overallStatus === 'ready') {
        await refreshApps()
      }

      return nextReadiness
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setBootError(message)
      return undefined
    } finally {
      setIsReadinessLoading(false)
    }
  })

  const bootstrap = useEffectEvent(async () => {
    try {
      if (!window.wsaApi) {
        throw new Error('The preload bridge is unavailable. Rebuild or reinstall the app.')
      }

      const [nextSettings, nextQueue, nextDiagnostics] = await Promise.all([
        withTimeout(window.wsaApi.getSettings(), 4_000, 'Settings load'),
        withTimeout(window.wsaApi.getInstallQueue(), 4_000, 'Install queue load'),
        withTimeout(window.wsaApi.getDiagnostics(), 4_000, 'Diagnostics load')
      ])

      startTransition(() => {
        setSettings(nextSettings)
        setQueue(nextQueue)
        setDiagnostics(nextDiagnostics.entries)
        setBuildInfo(nextDiagnostics.build)
        setBootError(undefined)
      })
    } catch (error) {
      setBootError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsBootstrapping(false)
    }

    void refreshReadiness()
  })

  useEffect(() => {
    if (!window.wsaApi) {
      setBootError('The preload bridge did not load, so the renderer cannot talk to Electron.')
      setIsBootstrapping(false)
      return
    }

    void bootstrap()

    const unsubscribeQueue = window.wsaApi.subscribeQueueEvents((event) => {
      startTransition(() => {
        setQueue(event.items)
      })

      if (event.items.some((item) => item.state === 'installed')) {
        void refreshApps()
      }
    })

    const unsubscribeDiagnostics = window.wsaApi.subscribeDiagnostics((entry) => {
      startTransition(() => {
        setDiagnostics((current) => [entry, ...current].slice(0, 300))
      })
    })

    return () => {
      unsubscribeQueue()
      unsubscribeDiagnostics()
    }
  }, [bootstrap, refreshApps])

  const runSetupCheck = async () => {
    setIsSetupBusy(true)
    try {
      const [nextReadiness, nextSettings] = await Promise.all([
        withTimeout(window.wsaApi.runSetupCheck(), 15_000, 'Setup check'),
        withTimeout(window.wsaApi.getSettings(), 4_000, 'Settings refresh')
      ])

      startTransition(() => {
        setReadiness(nextReadiness)
        setSettings(nextSettings)
        setBootError(undefined)
      })
      syncSetupWizardVisibility(nextReadiness)

      if (nextReadiness.overallStatus === 'ready') {
        await refreshApps()
      }
      return nextReadiness
    } finally {
      setIsSetupBusy(false)
    }
  }

  const saveAdbPath = async (adbPath?: string) => {
    const nextSettings = await window.wsaApi.saveAdbPath(adbPath)
    setSettings(nextSettings)
    return nextSettings
  }

  const chooseAdbPath = async () => {
    const adbPath = await window.wsaApi.pickAdbPath()
    if (!adbPath) {
      return undefined
    }

    await saveAdbPath(adbPath)
    return adbPath
  }

  const saveManualEndpoint = async (manualEndpoint?: string) => {
    const nextSettings = await window.wsaApi.setManualEndpoint(manualEndpoint)
    setSettings(nextSettings)
    return nextSettings
  }

  const enqueuePaths = async (paths: string[]) => {
    if (!readiness || readiness.overallStatus !== 'ready') {
      openSetupWizard()
      return
    }

    await window.wsaApi.enqueueApks(paths)
    setActiveView('install')
  }

  const pickApks = async () => {
    const paths = await window.wsaApi.pickApkFiles()
    if (paths.length > 0) {
      await enqueuePaths(paths)
    }
  }

  const scanCleanup = async (packageName?: string) => {
    setIsCleanupBusy(true)
    try {
      const result = await window.wsaApi.scanCleanup(packageName)
      setCleanupError(undefined)
      setCleanupScan(result)
      setActiveView('cleanup')
      return result
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      setIsCleanupBusy(false)
    }
  }

  const applyCleanup = async (findings: CleanupFinding[]): Promise<CleanupActionResult> => {
    setIsApplyingCleanup(true)
    try {
      const result = await window.wsaApi.applyCleanup(findings)
      await scanCleanup()
      return result
    } finally {
      setIsApplyingCleanup(false)
    }
  }

  const uninstallApp = async (packageName: string): Promise<UninstallResult> => {
    setUninstallingPackage(packageName)
    try {
      const result = await window.wsaApi.uninstallApp(packageName)
      await refreshApps()
      setCleanupScan(result.cleanupScan)
      if (result.cleanupScan.findings.length > 0) {
        setActiveView('cleanup')
      }
      return result
    } finally {
      setUninstallingPackage(undefined)
    }
  }

  const clearDiagnostics = async () => {
    await window.wsaApi.clearDiagnostics()
    setDiagnostics([])
  }

  const wakeWsa = async () => {
    setShowWakeModal(true)
  }

  return {
    activeView,
    setActiveView,
    settings,
    readiness,
    queue,
    apps,
    cleanupScan,
    diagnostics,
    buildInfo,
    bootError,
    appsError,
    cleanupError,
    isBootstrapping,
    isReadinessLoading,
    isSetupBusy,
    isAppsBusy,
    isCleanupBusy,
    isApplyingCleanup,
    uninstallingPackage,
    showSetupWizard,
    openSetupWizard,
    closeSetupWizard,
    showWakeModal,
    setShowWakeModal,
    runSetupCheck,
    saveAdbPath,
    chooseAdbPath,
    saveManualEndpoint,
    enqueuePaths,
    pickApks,
    refreshApps,
    scanCleanup,
    applyCleanup,
    uninstallApp,
    clearDiagnostics,
    wakeWsa
  }
}
