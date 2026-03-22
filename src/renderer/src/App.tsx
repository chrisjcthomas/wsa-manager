import { useDeferredValue, useEffect, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  Ghost,
  HardDrive,
  Loader2,
  Moon,
  Package,
  Play,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap
} from 'lucide-react'
import type { BuildInfo, CleanupFinding, DiagnosticLogEntry, InstallQueueItem, InstalledAppEntry, ReadinessSnapshot } from '@shared/contracts'
import { formatBytes, relativeTimeFromIso } from '@shared/utils/display'
import { useWsaManager, type ViewId } from './hooks/useWsaManager'

type ElectronFile = File & { path?: string }

function Dot({ color }: { color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
    yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.65)]',
    red: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
    blue: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]',
    gray: 'bg-zinc-600'
  }

  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${classes[color]}`} />
}

function appStatusColor(readiness: ReadinessSnapshot | null) {
  if (!readiness) {
    return 'gray' as const
  }

  if (readiness.connection.status === 'connected') {
    return 'green' as const
  }

  if (readiness.connection.status === 'sleeping') {
    return 'yellow' as const
  }

  return 'red' as const
}

function useWindowLayout() {
  const readLayout = () => {
    const width = window.innerWidth
    return {
      isCompact: width <= 1180,
      isNarrow: width <= 980
    }
  }

  const [layout, setLayout] = useState(() => readLayout())

  useEffect(() => {
    const handleResize = () => {
      setLayout(readLayout())
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return {
    ...layout,
    mode: layout.isNarrow ? 'narrow' : layout.isCompact ? 'compact' : 'desktop'
  }
}

function useDelayedFlag(active: boolean, delayMs: number) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => {
      setVisible(true)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [active, delayMs])

  return visible
}

function AppIcon({ entry }: { entry: InstalledAppEntry | InstallQueueItem }) {
  const label = 'label' in entry ? entry.label : entry.displayName
  const initials = label
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const key = label.toLowerCase()
  const explicitThemes: Record<string, string> = {
    instagram: 'from-pink-500 to-fuchsia-600',
    discord: 'from-indigo-500 to-violet-600',
    spotify: 'from-emerald-500 to-green-600'
  }
  const fallbackThemes = [
    'from-sky-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-indigo-600',
    'from-rose-500 to-orange-500'
  ]
  const matchedTheme = Object.entries(explicitThemes).find(([name]) => key.includes(name))?.[1]
  const theme =
    matchedTheme ??
    fallbackThemes[
      label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % fallbackThemes.length
    ]

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-[#202633] shadow-[0_12px_24px_rgba(15,23,42,0.26)]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-gradient-to-br ${theme} text-sm font-bold text-white`}>
        {initials || <FileQuestion size={16} className="text-white/75" />}
      </div>
    </div>
  )
}

function Sidebar({
  activeView,
  onChangeView,
  readiness,
  cleanupCount,
  isCompact
}: {
  activeView: ViewId
  onChangeView: (view: ViewId) => void
  readiness: ReadinessSnapshot | null
  cleanupCount: number
  isCompact: boolean
}) {
  const nav = [
    { id: 'install' as const, icon: Upload, label: 'Dashboard' },
    { id: 'apps' as const, icon: Package, label: 'Installed Apps' },
    { id: 'cleanup' as const, icon: Ghost, label: 'Cleanup', badge: cleanupCount },
    { id: 'diag' as const, icon: Terminal, label: 'Diagnostics' }
  ]

  const adbStatus =
    readiness?.adb.status === 'ready' ? 'Connected' : readiness?.adb.status === 'error' ? 'Issue' : 'Checking'
  const wsaStatus =
    readiness?.connection.status === 'connected' ? 'Ready' : readiness?.connection.status === 'sleeping' ? 'Sleeping' : 'Offline'

  return (
    <aside
      data-testid="sidebar"
      data-compact={isCompact ? 'true' : 'false'}
      className={`sidebar-shell flex h-full flex-shrink-0 flex-col text-slate-100 transition-[width,padding] duration-200 ${
        isCompact ? 'w-[72px] px-2 py-3' : 'w-[248px] px-3 py-4'
      }`}
    >
      <div className={`mb-8 pt-1 ${isCompact ? 'flex justify-center px-0' : 'flex items-center gap-3 px-3'}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-[0_10px_20px_rgba(5,150,105,0.35)]">
          W
        </div>
        {isCompact ? null : <p className="font-display text-[1.7rem] font-bold leading-none tracking-tight text-white">WSA Manager</p>}
      </div>

      <nav className={`flex-1 ${isCompact ? 'space-y-2' : 'space-y-1.5'}`}>
        {nav.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            aria-label={label}
            title={label}
            data-testid={`nav-${id}`}
            onClick={() => onChangeView(id)}
            className={`group relative flex text-sm font-medium transition-all ${
              isCompact
                ? `mx-auto h-12 w-12 items-center justify-center rounded-2xl border ${
                    activeView === id
                      ? 'border-emerald-500/40 bg-emerald-500/12 text-white'
                      : 'border-transparent text-slate-400 hover:border-white/6 hover:bg-white/[0.03] hover:text-white'
                  }`
                : activeView === id
                  ? 'w-full items-center gap-3 rounded-r-xl rounded-l-md border-l-2 border-emerald-500 bg-[linear-gradient(90deg,rgba(5,150,105,0.18)_0%,rgba(5,150,105,0)_100%)] px-3 py-2.5 text-white'
                  : 'w-full items-center gap-3 rounded-r-xl rounded-l-md border-l-2 border-transparent px-3 py-2.5 text-slate-400 hover:bg-white/[0.03] hover:text-white'
            }`}
          >
            <Icon size={17} className={activeView === id ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
            {isCompact ? null : <span className="flex-1 text-left">{label}</span>}
            {badge && !isCompact ? (
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">{badge}</span>
            ) : null}
            {badge && isCompact ? (
              <span className="absolute right-1 top-1 rounded-full bg-slate-800 px-1.5 py-[1px] text-[9px] font-bold text-slate-200">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className={`mt-auto border-t border-white/8 ${isCompact ? 'px-1 pt-4' : 'px-3 pt-5'}`}>
        {isCompact ? (
          <div className="flex flex-col items-center gap-3">
            <div
              title={`WSA ${wsaStatus}`}
              className={`h-2.5 w-2.5 rounded-full ${
                wsaStatus === 'Ready' ? 'bg-emerald-400' : wsaStatus === 'Sleeping' ? 'bg-amber-400' : 'bg-red-400'
              }`}
            />
            <div
              title={`ADB ${adbStatus}`}
              className={`h-2.5 w-2.5 rounded-full ${
                adbStatus === 'Connected' ? 'bg-cyan-400' : adbStatus === 'Checking' ? 'bg-slate-300' : 'bg-red-400'
              }`}
            />
          </div>
        ) : (
          <div className="space-y-3 text-[11px] font-semibold uppercase tracking-[0.22em]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">WSA Status:</span>
              <span className={wsaStatus === 'Ready' ? 'text-emerald-400' : wsaStatus === 'Sleeping' ? 'text-amber-400' : 'text-red-400'}>
                {wsaStatus}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">ADB Status:</span>
              <span className={adbStatus === 'Connected' ? 'text-cyan-400' : adbStatus === 'Checking' ? 'text-slate-300' : 'text-red-400'}>
                {adbStatus}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function StatusCallout({
  icon: Icon,
  title,
  body,
  tone = 'neutral',
  action
}: {
  icon: typeof AlertCircle
  title: string
  body: string
  tone?: 'neutral' | 'warn' | 'success' | 'danger'
  action?: ReactNode
}) {
  const tones = {
    neutral: 'border-slate-700/50 bg-[#2f363d]/92 text-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.22)]',
    warn: 'border-amber-400/20 bg-[#343a41]/94 text-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.24)]',
    success: 'border-emerald-500/20 bg-[#304239]/94 text-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.22)]',
    danger: 'border-red-500/20 bg-[#402d31]/94 text-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.22)]'
  }
  const iconTones = {
    neutral: 'bg-slate-800 text-slate-200',
    warn: 'bg-amber-400 text-slate-950',
    success: 'bg-emerald-500 text-white',
    danger: 'bg-red-500 text-white'
  }

  return (
    <div className={`rounded-2xl border px-5 py-4 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-xl p-2 ${iconTones[tone]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-300">{body}</p>
        </div>
        {action}
      </div>
    </div>
  )
}

export function InstallView({
  readiness,
  queue,
  onPickFiles,
  onEnqueuePaths,
  onOpenSetup,
  onWake,
  isCompact,
  isNarrow
}: {
  readiness: ReadinessSnapshot | null
  queue: InstallQueueItem[]
  onPickFiles: () => Promise<void>
  onEnqueuePaths: (paths: string[]) => Promise<void>
  onOpenSetup: () => void
  onWake: () => void
  isCompact: boolean
  isNarrow: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const isReady = readiness?.overallStatus === 'ready'

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as ElectronFile).path)
      .filter((value): value is string => Boolean(value))

    if (paths.length > 0) {
      await onEnqueuePaths(paths)
    }
  }

  const stateMap: Record<InstallQueueItem['state'], { label: string; color: string; bar: string; pill: string }> = {
    queued: { label: 'Queued', color: 'text-slate-300', bar: 'bg-slate-500', pill: 'bg-slate-900/75 text-slate-400' },
    connecting: { label: 'Connecting', color: 'text-amber-300', bar: 'bg-amber-400', pill: 'bg-amber-500/10 text-amber-300' },
    installing: { label: 'Installing', color: 'text-cyan-300', bar: 'bg-emerald-500', pill: 'bg-cyan-500/10 text-cyan-300' },
    installed: { label: 'Installed', color: 'text-emerald-300', bar: 'bg-emerald-500', pill: 'bg-emerald-500/10 text-emerald-300' },
    failed: { label: 'Failed', color: 'text-red-300', bar: 'bg-red-500', pill: 'bg-red-500/10 text-red-300' },
    rejected: { label: 'Rejected', color: 'text-red-300', bar: 'bg-red-500', pill: 'bg-red-500/10 text-red-300' }
  }

  return (
    <div data-testid="install-view" className={`flex h-full min-h-0 flex-col ${isNarrow ? 'gap-4' : 'gap-5'}`}>
      {readiness?.connection.status !== 'connected' ? (
        <StatusCallout
          icon={Moon}
          title="WSA is currently sleeping"
          body="The first app launch may take longer than usual while the subsystem wakes up."
          tone="warn"
          action={
            <div className={`flex ${isNarrow ? 'w-full flex-col gap-2' : 'gap-2'}`}>
              <button
                onClick={onWake}
                className="rounded-xl bg-white/12 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                Wake Now
              </button>
              <button
                onClick={onOpenSetup}
                className="rounded-xl border border-white/12 bg-transparent px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10"
              >
                Wizard
              </button>
            </div>
          }
        />
      ) : null}

      <div
        data-testid="hero-dropzone"
        onDragOver={(event) => {
          event.preventDefault()
          if (isReady) {
            setIsDragging(true)
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          void handleDrop(event)
        }}
        className={`hero-dropzone relative flex flex-col items-center justify-center gap-4 overflow-hidden border-[3px] border-dashed text-center transition-all ${
          isNarrow ? 'min-h-[168px] rounded-[1.5rem] px-4 py-5' : isCompact ? 'min-h-[186px] rounded-[1.8rem] px-5 py-6' : 'min-h-[198px] rounded-[2rem] px-6 py-6'
        } ${
          isReady
            ? isDragging
              ? 'border-emerald-400 bg-white/16'
              : 'border-white/70 bg-white/8 hover:bg-white/12'
            : 'border-white/55 bg-white/7'
        }`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))]" />
        <div className="relative">
          <div
            className={`flex items-center justify-center rounded-full border border-white/35 bg-white/14 shadow-[0_18px_36px_rgba(255,255,255,0.06)] ${
              isNarrow ? 'h-14 w-14' : isCompact ? 'h-16 w-16' : 'h-[4.4rem] w-[4.4rem]'
            }`}
          >
            <Upload size={isNarrow ? 24 : 28} className={isDragging ? 'text-emerald-600' : 'text-white'} />
          </div>
          <div
            className={`absolute -right-1 -top-1 flex items-center justify-center rounded-full border-4 border-[#6e958d] bg-white text-emerald-700 shadow-[0_10px_18px_rgba(0,0,0,0.18)] ${
              isNarrow ? 'h-6 w-6' : 'h-7 w-7'
            }`}
          >
            <span className={`${isNarrow ? 'text-lg' : 'text-xl'} leading-none`}>+</span>
          </div>
        </div>
        <div className="relative max-w-[54rem]">
          <p
            className={`font-display font-bold tracking-tight text-white ${
              isNarrow ? 'text-[2rem]' : isCompact ? 'text-[2.5rem]' : 'text-[2.9rem]'
            }`}
          >
            {isReady ? (isDragging ? 'Release to add APK files' : 'Add more APK files') : 'Add more APK files'}
          </p>
          <p className={`mx-auto mt-3 max-w-2xl font-semibold leading-relaxed text-white/88 ${isNarrow ? 'text-sm' : isCompact ? 'text-[0.98rem]' : 'text-lg'}`}>
            {isReady
              ? 'Drag & drop your Android packages here to begin the seamless Windows integration.'
              : 'Finish setup first, then drag & drop your Android packages here to begin the seamless Windows integration.'}
          </p>
        </div>
        <div className={`relative flex ${isNarrow ? 'w-full flex-col gap-2 sm:w-auto sm:flex-row' : 'gap-2.5'}`}>
          <button
            onClick={isReady ? () => void onPickFiles() : onOpenSetup}
            className="rounded-xl bg-[#0f172acc] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#0f172ae6]"
          >
            {isReady ? 'Browse Files' : 'Open Wizard'}
          </button>
          {isReady ? null : (
            <button
              onClick={onWake}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500"
            >
              Wake WSA
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <div className={`grid grid-cols-1 items-start ${isNarrow ? 'gap-4' : 'gap-5'} ${isNarrow ? '' : 'md:grid-cols-2'} ${isCompact && !isNarrow ? '' : 'xl:grid-cols-3'}`}>
          {queue.length === 0 ? (
            <div
              data-testid="queue-empty-state"
              className="queue-card rounded-[1.75rem] border border-slate-700/45 p-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.18)] md:col-span-2 xl:col-span-3"
            >
              <Package size={20} className="mx-auto text-zinc-600" />
              <p className="mt-4 text-xl font-semibold text-white">No APKs in the queue yet</p>
              <p className="mt-2 text-sm text-slate-300">When you add APK files, their install progress and verification details will appear here.</p>
            </div>
          ) : (
            <>
            {queue.map((item) => {
              const config = stateMap[item.state]
              const progress = item.state === 'installed' ? 100 : item.state === 'queued' ? 12 : Math.max(item.progress, 8)
              const meta =
                item.state === 'installed'
                  ? `Package: ${item.packageName ?? 'Verified after install'}`
                  : item.state === 'installing'
                    ? `Installing on ${readiness?.connection.endpoint ?? 'WSA'}`
                    : item.state === 'connecting'
                      ? 'Finding the best local endpoint for WSA'
                      : item.state === 'failed' || item.state === 'rejected'
                        ? 'This package needs attention before it can be installed.'
                        : `Size: ${formatBytes(item.sizeBytes)}`

              return (
                <div
                  key={item.id}
                  className={`queue-card flex min-h-[220px] flex-col rounded-[2rem] border p-5 shadow-[0_24px_40px_rgba(15,23,42,0.18)] transition-transform duration-300 hover:-translate-y-1 ${
                    item.state === 'failed' || item.state === 'rejected'
                      ? 'border-red-500/20'
                      : item.state === 'installed'
                        ? 'border-emerald-500/18'
                        : 'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <AppIcon entry={item} />
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${config.pill}`}>
                      {config.label}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="truncate text-[1.12rem] font-bold text-white">{item.fileName}</p>
                    <p className="mt-1 text-sm text-slate-400">{meta}</p>
                  </div>

                  <div className="mt-auto pt-6">
                    {item.state === 'installed' ? (
                      <>
                        <div className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-[0_14px_28px_rgba(5,150,105,0.28)]">
                          Installed to WSA
                        </div>
                        <p className="mt-3 truncate text-[11px] font-mono text-slate-400">{item.packageName ?? 'Package name pending verification'}</p>
                      </>
                    ) : item.state === 'failed' || item.state === 'rejected' ? (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-sm font-semibold text-red-200">{item.error ?? 'This APK could not be installed.'}</p>
                        <p className="mt-2 text-xs text-red-100/70">Check Diagnostics for the adb output and retry after fixing setup.</p>
                      </div>
                    ) : item.state === 'queued' ? (
                      <div className="flex items-center gap-2 pt-6 text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500/80" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500/60" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500/40" />
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                          <span>{item.state === 'connecting' ? 'Checking device availability...' : 'Copying package and verifying install...'}</span>
                          <span className={config.color}>{progress}%</span>
                        </div>
                        <div className="overflow-hidden rounded-full bg-[#1e293b]/70">
                          <div className={`relative h-2 ${config.bar}`} style={{ width: `${progress}%` }}>
                            {item.state === 'installing' || item.state === 'connecting' ? (
                              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                            ) : null}
                          </div>
                        </div>
                        {item.packageName ? <p className="truncate text-[11px] font-mono text-slate-400">{item.packageName}</p> : null}
                        {item.error ? <p className="text-xs text-red-300">{item.error}</p> : null}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AppsView({
  readiness,
  apps,
  isBusy,
  error,
  uninstallingPackage,
  onRefresh,
  onUninstall,
  onOpenSetup
}: {
  readiness: ReadinessSnapshot | null
  apps: InstalledAppEntry[]
  isBusy: boolean
  error?: string
  uninstallingPackage?: string
  onRefresh: () => Promise<void>
  onUninstall: (packageName: string) => Promise<void>
  onOpenSetup: () => void
}) {
  const [search, setSearch] = useState('')
  const [confirmPackage, setConfirmPackage] = useState<string>()
  const deferredSearch = useDeferredValue(search)

  const filteredApps = apps.filter((app) => {
    const term = deferredSearch.toLowerCase()
    return app.label.toLowerCase().includes(term) || app.packageName.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-4">
      {readiness?.overallStatus !== 'ready' ? (
        <StatusCallout
          icon={Shield}
          title="App actions are locked until setup passes"
          body="You can still inspect the last loaded app list, but uninstall is disabled while ADB or WSA is unavailable."
          tone="warn"
          action={
            <button
              onClick={onOpenSetup}
              className="rounded-xl border border-amber-500/30 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-200 transition-all hover:bg-amber-500/30"
            >
              Fix setup
            </button>
          }
        />
      ) : null}

      {error ? <StatusCallout icon={AlertCircle} title="Could not refresh installed apps" body={error} tone="danger" /> : null}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by app name or package..."
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-sky-500/30 focus:bg-white/[0.06]"
          />
        </div>
        <button
          onClick={() => void onRefresh()}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-zinc-400 transition-all hover:bg-white/[0.07] hover:text-zinc-200"
        >
          <RefreshCw size={15} className={isBusy ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{filteredApps.length} app(s) shown</span>
        <span>{readiness?.connection.endpoint ?? 'No active endpoint'}</span>
      </div>

      {filteredApps.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-12 text-center">
          <Package size={20} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm font-semibold text-zinc-300">No matching apps</p>
          <p className="mt-1 text-xs text-zinc-500">Try a different search or refresh from the device.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredApps.map((app) => {
            const isUninstalling = uninstallingPackage === app.packageName
            const isConfirming = confirmPackage === app.packageName
            return (
              <div
                key={app.packageName}
                className={`group rounded-3xl border p-4 transition-all ${
                  isConfirming ? 'border-white/[0.12] bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AppIcon entry={app} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">{app.label}</p>
                        <p className="mt-1 truncate text-[11px] font-mono text-zinc-500">{app.packageName}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {app.labelSource}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                      <span>{app.sizeLabel}</span>
                      <span className="text-zinc-700">·</span>
                      <span>Seen {relativeTimeFromIso(app.lastInstalledAt)}</span>
                    </div>
                    <div className="mt-4">
                      {isConfirming ? (
                        <div className="flex gap-2">
                          <button
                            disabled={readiness?.overallStatus !== 'ready' || isUninstalling}
                            onClick={() => void onUninstall(app.packageName).then(() => setConfirmPackage(undefined))}
                            className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 transition-all hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isUninstalling ? 'Removing...' : 'Confirm uninstall'}
                          </button>
                          <button
                            onClick={() => setConfirmPackage(undefined)}
                            className="rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.08]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={readiness?.overallStatus !== 'ready' || isUninstalling}
                          onClick={() => setConfirmPackage(app.packageName)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isUninstalling ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {isUninstalling ? 'Removing...' : 'Uninstall'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CleanupView({
  cleanupScan,
  isBusy,
  isApplying,
  error,
  onScan,
  onApply
}: {
  cleanupScan: { warnings: string[]; findings: CleanupFinding[] } | null
  isBusy: boolean
  isApplying: boolean
  error?: string
  onScan: () => Promise<void>
  onApply: (findings: CleanupFinding[]) => Promise<void>
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const findings = cleanupScan?.findings ?? []

  useEffect(() => {
    setSelectedIds(findings.filter((finding) => finding.selectedByDefault).map((finding) => finding.id))
  }, [cleanupScan])

  const selectedFindings = findings.filter((finding) => selectedIds.includes(finding.id))

  return (
    <div className="space-y-5">
      <StatusCallout
        icon={findings.length > 0 ? Ghost : Sparkles}
        title={findings.length > 0 ? `${findings.length} Windows artifact(s) found` : 'Windows and Android are in sync'}
        body={
          findings.length > 0
            ? 'Review the stale shortcuts, icons, and registry entries before applying cleanup.'
            : 'Run a cleanup scan after uninstalling apps or if Start Menu ghosts linger.'
        }
        tone={findings.length > 0 ? 'warn' : 'success'}
        action={
          <button
            onClick={() => void onScan()}
            className="rounded-xl border border-sky-500/25 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 transition-all hover:bg-sky-500/25"
          >
            <span className="inline-flex items-center gap-2">
              <ScanLine size={13} className={isBusy ? 'animate-pulse' : ''} />
              {isBusy ? 'Scanning...' : 'Scan'}
            </span>
          </button>
        }
      />

      {error ? <StatusCallout icon={AlertCircle} title="Cleanup scan failed" body={error} tone="danger" /> : null}

      {cleanupScan?.warnings.length ? (
        <div className="space-y-2">
          {cleanupScan.warnings.map((warning) => (
            <StatusCallout key={warning} icon={AlertTriangle} title="Cleanup warning" body={warning} tone="warn" />
          ))}
        </div>
      ) : null}

      {findings.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">{selectedFindings.length} item(s) selected</div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(findings.map((finding) => finding.id))}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.08]"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.08]"
              >
                Clear
              </button>
              <button
                disabled={selectedFindings.length === 0 || isApplying}
                onClick={() => void onApply(selectedFindings)}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isApplying ? 'Applying...' : 'Apply selected cleanup'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {findings.map((finding) => {
              const checked = selectedIds.includes(finding.id)
              return (
                <label
                  key={finding.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-all ${
                    checked ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setSelectedIds((current) =>
                        event.target.checked ? [...current, finding.id] : current.filter((value) => value !== finding.id)
                      )
                    }}
                    className="mt-1 h-4 w-4 rounded border-white/15 bg-transparent text-sky-500 focus:ring-sky-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{finding.label}</p>
                        <p className="mt-1 text-[11px] font-mono text-zinc-500">{finding.packageName}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        {finding.artifactType.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">{finding.detail}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">{finding.target}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-10 text-center">
          <Ghost size={18} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm font-semibold text-zinc-300">No cleanup findings loaded</p>
          <p className="mt-1 text-xs text-zinc-500">Run a scan to compare Windows leftovers against Android packages.</p>
        </div>
      )}
    </div>
  )
}

function DiagnosticsView({
  readiness,
  diagnostics,
  buildInfo,
  queue,
  onClear,
  isCompact
}: {
  readiness: ReadinessSnapshot | null
  diagnostics: DiagnosticLogEntry[]
  buildInfo: BuildInfo | null
  queue: InstallQueueItem[]
  onClear: () => Promise<void>
  isCompact: boolean
}) {
  const summaryCards = [
    {
      label: 'Build',
      value: buildInfo?.buildLabel ?? 'Unknown build',
      icon: Sparkles
    },
    {
      label: 'ADB',
      value: readiness?.adb.version ?? readiness?.adb.status ?? 'Unknown',
      icon: HardDrive
    },
    {
      label: 'WSA',
      value: readiness?.wsa.version ?? readiness?.wsa.status ?? 'Unknown',
      icon: Smartphone
    },
    {
      label: 'Endpoint',
      value: readiness?.connection.endpoint ?? 'Not connected',
      icon: readiness?.connection.status === 'connected' ? Wifi : WifiOff
    },
    {
      label: 'Queue',
      value: `${queue.length} tracked`,
      icon: Zap
    }
  ]

  const copyLogs = async () => {
    await navigator.clipboard.writeText(
      [`Build ${buildInfo?.buildLabel ?? 'Unknown build'}`]
        .concat(
          diagnostics.map(
            (entry) => `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`
          )
        )
        .join('\n')
    )
  }

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 gap-3 ${isCompact ? 'lg:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-5'}`}>
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[1.6rem] border border-white/[0.06] bg-white/[0.035] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{label}</span>
              <Icon size={14} className="text-zinc-500" />
            </div>
            <p
              data-testid={label === 'Build' ? 'diagnostics-build-label' : undefined}
              className={`mt-3 break-words ${label === 'Build' ? 'text-sm font-semibold text-zinc-100' : 'font-mono text-sm text-zinc-100'}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className={`flex ${isCompact ? 'flex-col gap-3' : 'items-center justify-between'}`}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Activity Log</h3>
          <p className="mt-1 text-xs text-zinc-600">
            {diagnostics.length} event(s) retained
            {buildInfo ? ` • ${buildInfo.appVersion}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void copyLogs()}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.08]"
          >
            Copy
          </button>
          <button
            onClick={() => void onClear()}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.08]"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-[1.6rem] border border-white/[0.07] bg-black/20 p-4">
        {diagnostics.length === 0 ? (
          <p className="text-sm text-zinc-500">No diagnostic events yet.</p>
        ) : (
          diagnostics.map((entry) => (
            <div key={entry.id} className={`rounded-[1.2rem] border border-white/[0.04] bg-white/[0.02] p-3 ${isCompact ? 'space-y-2' : 'flex gap-3'}`}>
              <span
                data-testid="diagnostics-entry-timestamp"
                className={`${isCompact ? 'block' : 'w-24 flex-shrink-0'} text-[11px] font-mono text-zinc-600`}
              >
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                      entry.level === 'success'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : entry.level === 'warn'
                          ? 'bg-amber-500/15 text-amber-300'
                          : entry.level === 'error'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-white/[0.07] text-zinc-400'
                    }`}
                  >
                    {entry.level}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{entry.source}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-200">{entry.message}</p>
                {entry.detail ? <p className="mt-1 text-xs text-zinc-500">{entry.detail}</p> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SetupWizard({
  readiness,
  settings,
  isBusy,
  onClose,
  onRunChecks,
  onChooseAdbPath,
  onSaveAdbPath,
  onSaveManualEndpoint,
  onOpenWake,
  isNarrow
}: {
  readiness: ReadinessSnapshot | null
  settings: { adbPath?: string; manualEndpoint?: string } | null
  isBusy: boolean
  onClose: () => void
  onRunChecks: () => Promise<unknown>
  onChooseAdbPath: () => Promise<string | undefined>
  onSaveAdbPath: (adbPath?: string) => Promise<void>
  onSaveManualEndpoint: (manualEndpoint?: string) => Promise<void>
  onOpenWake: () => void
  isNarrow: boolean
}) {
  const [adbDraft, setAdbDraft] = useState(settings?.adbPath ?? '')
  const [endpointDraft, setEndpointDraft] = useState(settings?.manualEndpoint ?? '')

  useEffect(() => {
    setAdbDraft(settings?.adbPath ?? '')
    setEndpointDraft(settings?.manualEndpoint ?? '')
  }, [settings])

  return (
    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm">
      <div className={`flex h-full w-full items-center justify-center ${isNarrow ? 'p-0' : 'p-4 md:p-6'}`}>
        <div
          data-testid="setup-sheet"
          className={`animate-rise-in glass-panel flex w-full flex-col overflow-hidden border border-white/[0.09] shadow-[0_30px_90px_rgba(0,0,0,0.5)] ${
            isNarrow ? 'h-full rounded-none' : 'max-h-[calc(100vh-2rem)] max-w-5xl rounded-[1.75rem]'
          }`}
        >
          <div className={`flex items-start justify-between gap-4 border-b border-white/[0.06] ${isNarrow ? 'px-4 py-4' : 'px-6 py-5'}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Setup Wizard</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-50">Bring WSA Manager online</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Confirm WSA is installed, point the app at a working adb.exe, and optionally save a manual endpoint for non-default community builds.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close setup wizard"
              data-testid="setup-close-button"
              className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          </div>

        <div className={`grid flex-1 gap-4 overflow-y-auto ${isNarrow ? 'grid-cols-1 px-4 py-4' : 'px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]'}`}>
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-2">
                  <Shield size={16} className="text-sky-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">Readiness summary</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Dot color={readiness?.adb.status === 'ready' ? 'green' : 'red'} />
                        <span className="text-sm text-zinc-200">ADB</span>
                      </div>
                      <span className="text-xs text-zinc-500">{readiness?.adb.version ?? readiness?.adb.message ?? 'Waiting'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Dot color={readiness?.wsa.status === 'ready' ? 'green' : readiness?.wsa.status === 'sleeping' ? 'yellow' : 'red'} />
                        <span className="text-sm text-zinc-200">WSA</span>
                      </div>
                      <span className="text-xs text-zinc-500">{readiness?.wsa.version ?? readiness?.wsa.message ?? 'Waiting'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Dot color={readiness?.connection.status === 'connected' ? 'green' : 'yellow'} />
                        <span className="text-sm text-zinc-200">Connection</span>
                      </div>
                      <span className="text-xs text-zinc-500">{readiness?.connection.endpoint ?? readiness?.connection.message ?? 'Waiting'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-zinc-100">ADB executable</p>
              <p className="mt-1 text-xs text-zinc-500">Saved path is preferred over PATH lookup when you want a specific Android SDK install.</p>
              <div className={`mt-4 flex ${isNarrow ? 'flex-col' : 'gap-2'}`}>
                <input
                  value={adbDraft}
                  onChange={(event) => setAdbDraft(event.target.value)}
                  placeholder="C:\\Android\\platform-tools\\adb.exe"
                  className="flex-1 rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-sky-500/30"
                />
                <button
                  onClick={() => void onChooseAdbPath().then((value) => value && setAdbDraft(value))}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm font-semibold text-zinc-200 transition-all hover:bg-white/[0.09]"
                >
                  Browse
                </button>
                <button
                  onClick={() => void onSaveAdbPath(adbDraft || undefined)}
                  className="rounded-2xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition-all hover:bg-sky-500/25"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-zinc-100">Manual endpoint override</p>
              <p className="mt-1 text-xs text-zinc-500">Optional. Use this if your WSA build exposes a non-default local IP or port.</p>
              <div className={`mt-4 flex ${isNarrow ? 'flex-col' : 'gap-2'}`}>
                <input
                  value={endpointDraft}
                  onChange={(event) => setEndpointDraft(event.target.value)}
                  placeholder="127.0.0.1:58526"
                  className="flex-1 rounded-2xl border border-white/[0.08] bg-black/10 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-sky-500/30"
                />
                <button
                  onClick={() => void onSaveManualEndpoint(endpointDraft || undefined)}
                  className="rounded-2xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition-all hover:bg-sky-500/25"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-zinc-100">Recommended flow</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                {[
                  'Confirm WSA exists on this machine.',
                  'Choose or auto-detect a valid adb.exe.',
                  'Wake WSA if the subsystem is sleeping.',
                  'Run checks until ADB and WSA report ready.'
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <ChevronRight size={16} className="mt-0.5 text-sky-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {readiness?.messages.length ? (
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-zinc-100">Current notes</p>
                <div className="mt-3 space-y-2">
                  {readiness.messages.map((message) => (
                    <div key={message} className="rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2 text-xs text-zinc-400">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-4">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void onRunChecks()}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200 transition-all hover:bg-emerald-500/25"
                >
                  <span className="inline-flex items-center gap-2">
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                    {isBusy ? 'Running checks...' : 'Run setup checks'}
                  </span>
                </button>
                <button
                  onClick={onOpenWake}
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200 transition-all hover:bg-amber-500/25"
                >
                  <span className="inline-flex items-center gap-2">
                    <Play size={14} />
                    Wake WSA
                  </span>
                </button>
                <button
                  disabled={readiness?.overallStatus !== 'ready'}
                  onClick={onClose}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-zinc-200 transition-all hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue into app
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function WakeModal({
  onClose,
  onCompleted,
  isNarrow
}: {
  onClose: () => void
  onCompleted: () => Promise<void>
  isNarrow: boolean
}) {
  const [phase, setPhase] = useState<'prompt' | 'waking' | 'done' | 'error'>('prompt')
  const [message, setMessage] = useState('Send a wake signal to the WSA settings app and then recheck ADB readiness.')

  const handleWake = async () => {
    setPhase('waking')
    setMessage('Opening the WSA settings app and waiting for ADB to respond...')
    const woke = await window.wsaApi.wakeWsa()
    if (!woke) {
      setPhase('error')
      setMessage('The wake signal failed. Make sure WSA is installed and try again.')
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 2500))
    await onCompleted()
    const readiness = await window.wsaApi.getReadiness()
    if (readiness.overallStatus === 'ready') {
      setPhase('done')
      setMessage(`Connected to ${readiness.connection.endpoint}.`)
    } else {
      setPhase('error')
      setMessage(readiness.connection.message ?? 'WSA still is not accepting ADB connections.')
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm md:p-6">
      <div
        data-testid="wake-modal"
        className={`w-full border border-white/[0.1] bg-[#1b1f21] shadow-[0_30px_90px_rgba(0,0,0,0.6)] ${
          isNarrow ? 'max-w-[92vw] rounded-[1.5rem] p-5' : 'max-w-sm rounded-[1.75rem] p-6'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-3xl ${
              phase === 'done'
                ? 'bg-emerald-500/20 text-emerald-300'
                : phase === 'error'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {phase === 'waking' ? (
              <Loader2 size={26} className="animate-spin" />
            ) : phase === 'done' ? (
              <Shield size={26} />
            ) : phase === 'error' ? (
              <AlertCircle size={26} />
            ) : (
              <Moon size={26} />
            )}
          </div>
          <h3 className="mt-4 text-lg font-bold text-zinc-50">
            {phase === 'done' ? 'WSA is awake' : phase === 'error' ? 'Wake attempt failed' : 'Wake WSA'}
          </h3>
          <p className="mt-2 text-sm text-zinc-400">{message}</p>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-zinc-300 transition-all hover:bg-white/[0.09]"
          >
            {phase === 'done' ? 'Close' : 'Later'}
          </button>
          {phase !== 'done' ? (
            <button
              onClick={() => void handleWake()}
              disabled={phase === 'waking'}
              className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-200 transition-all hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-2">
                {phase === 'waking' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {phase === 'waking' ? 'Waking...' : 'Wake now'}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const {
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
  } = useWsaManager()
  const { isCompact, isNarrow, mode } = useWindowLayout()

  const cleanupCount = cleanupScan?.findings.length ?? 0
  const showReadinessLoadingChip = useDelayedFlag(isReadinessLoading, 600)
  const viewTitle: Record<ViewId, string> = {
    install: 'Dashboard',
    apps: 'Installed Apps',
    cleanup: 'Cleanup',
    diag: 'Diagnostics'
  }
  const viewSubtitle: Record<ViewId, string> = {
    install: 'Manage your Android apps on Windows 11',
    apps: 'Review installed apps and remove packages cleanly.',
    cleanup: 'Find leftover Windows artifacts and keep WSA tidy.',
    diag: 'Inspect ADB, endpoint state, and recent system activity.'
  }

  return (
    <div data-testid="app-shell" data-layout={mode} className="h-screen w-screen overflow-hidden bg-[#232723] text-white">
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar
          activeView={activeView}
          onChangeView={setActiveView}
          readiness={readiness}
          cleanupCount={cleanupCount}
          isCompact={isCompact}
        />

        <main className="workspace-shell relative flex min-w-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(112,142,129,0.16),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(255,240,175,0.08),transparent_24%),linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_33.33%),linear-gradient(180deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_33.33%)] opacity-65" />
          <div
            data-testid="workspace-scroll-root"
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ${isNarrow ? 'px-4 py-4' : isCompact ? 'px-5 py-5' : 'px-6 py-5 lg:px-8 lg:py-6'}`}
          >
            <div className={`mb-3 flex flex-col gap-3 ${isCompact ? '' : 'lg:flex-row lg:items-start lg:justify-between'}`}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{isCompact ? 'WSA Manager' : 'Windows utility'}</p>
                <h1 className={`font-display font-bold tracking-tight text-white/96 ${isNarrow ? 'mt-2 text-3xl' : isCompact ? 'mt-2 text-4xl' : 'mt-2 text-4xl lg:text-5xl'}`}>
                  {viewTitle[activeView]}
                </h1>
                <p className={`mt-2 font-semibold text-white/82 ${isNarrow ? 'text-base' : 'text-lg lg:text-xl'}`}>
                  {viewSubtitle[activeView]}
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  {isBootstrapping
                    ? 'Loading settings and recent activity...'
                    : readiness?.overallStatus === 'ready'
                    ? `Ready on ${readiness.connection.endpoint ?? 'WSA'}`
                    : 'Setup is incomplete. Cleanup and diagnostics remain available.'}
                </p>
              </div>
              <div className={`flex flex-wrap items-center gap-2 ${isCompact ? '' : 'justify-start lg:justify-end'}`}>
                  {showReadinessLoadingChip ? (
                    <span
                      data-testid="readiness-loading-chip"
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200"
                    >
                      <Loader2 size={14} className="animate-spin" />
                      Checking device state...
                    </span>
                ) : null}
                {bootError ? (
                  <span data-testid="boot-error-chip" className="rounded-full border border-red-500/20 bg-red-500/12 px-4 py-2 text-sm font-semibold text-red-200">
                    {bootError}
                  </span>
                ) : null}
                <button
                  onClick={() => openSetupWizard()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1b212a] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#151a21]"
                >
                  <Settings size={15} />
                  Setup Wizard
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {activeView === 'install' ? (
                <InstallView
                  readiness={readiness}
                  queue={queue}
                  onPickFiles={pickApks}
                  onEnqueuePaths={enqueuePaths}
                  onOpenSetup={() => openSetupWizard()}
                  onWake={wakeWsa}
                  isCompact={isCompact}
                  isNarrow={isNarrow}
                />
              ) : null}
              {activeView === 'apps' ? (
                <AppsView
                  readiness={readiness}
                  apps={apps}
                  isBusy={isAppsBusy}
                  error={appsError}
                  uninstallingPackage={uninstallingPackage}
                  onRefresh={refreshApps}
                  onUninstall={async (packageName) => {
                    await uninstallApp(packageName)
                  }}
                  onOpenSetup={() => openSetupWizard()}
                />
              ) : null}
              {activeView === 'cleanup' ? (
                <CleanupView
                  cleanupScan={cleanupScan}
                  isBusy={isCleanupBusy}
                  isApplying={isApplyingCleanup}
                  error={cleanupError}
                  onScan={async () => {
                    await scanCleanup()
                  }}
                  onApply={async (findings) => {
                    await applyCleanup(findings)
                  }}
                />
              ) : null}
              {activeView === 'diag' ? (
                <DiagnosticsView readiness={readiness} diagnostics={diagnostics} buildInfo={buildInfo} queue={queue} onClear={clearDiagnostics} isCompact={isCompact} />
              ) : null}
            </div>
          </div>

          {showSetupWizard ? (
            <SetupWizard
              readiness={readiness}
              settings={settings}
              isBusy={isSetupBusy}
              onClose={() => closeSetupWizard()}
              onRunChecks={runSetupCheck}
              onChooseAdbPath={chooseAdbPath}
              onSaveAdbPath={async (adbPath) => {
                await saveAdbPath(adbPath)
              }}
              onSaveManualEndpoint={async (manualEndpoint) => {
                await saveManualEndpoint(manualEndpoint)
              }}
              onOpenWake={wakeWsa}
              isNarrow={isNarrow}
            />
          ) : null}

          {showWakeModal ? (
            <WakeModal
              onClose={() => setShowWakeModal(false)}
              onCompleted={async () => {
                await runSetupCheck()
              }}
              isNarrow={isNarrow}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
