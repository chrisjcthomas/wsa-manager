export function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** exponent

  return `${amount >= 100 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`
}

export function deriveLabelFromPackageName(packageName: string): string {
  const tail = packageName.split('.').filter(Boolean).at(-1) ?? packageName
  return tail
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function deriveLabelFromFilePath(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).at(-1) ?? filePath
  const baseName = fileName.replace(/\.[^.]+$/, '')
  return baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function relativeTimeFromIso(isoString?: string): string {
  if (!isoString) {
    return 'Unknown'
  }

  const target = new Date(isoString).getTime()
  const diffMs = Date.now() - target
  const diffHours = Math.max(Math.floor(diffMs / (60 * 60 * 1000)), 0)

  if (diffHours < 1) {
    return 'Just now'
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return new Date(isoString).toLocaleDateString()
}
