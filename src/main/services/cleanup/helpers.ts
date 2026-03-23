import path from 'node:path'
import type { CleanupFinding } from '@shared/contracts'
import { deriveLabelFromPackageName } from '@shared/utils/display'

export function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function buildSearchTokens(packageName: string, label: string): string[] {
  const packageTail = packageName.split('.').at(-1) ?? packageName
  return [packageName, packageTail, label, deriveLabelFromPackageName(packageName)]
    .map(normalizeForSearch)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
}

export function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const resolvedCandidate = normalizePathForComparison(path.resolve(candidatePath))
  const resolvedRoot = normalizePathForComparison(path.resolve(rootPath))
  const relative = path.relative(resolvedRoot, resolvedCandidate)

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function isMatchingCleanupFinding(requestedFinding: CleanupFinding, scannedFinding: CleanupFinding): boolean {
  return (
    requestedFinding.id === scannedFinding.id &&
    requestedFinding.packageName === scannedFinding.packageName &&
    requestedFinding.label === scannedFinding.label &&
    requestedFinding.artifactType === scannedFinding.artifactType &&
    requestedFinding.target === scannedFinding.target &&
    requestedFinding.locationLabel === scannedFinding.locationLabel &&
    requestedFinding.detail === scannedFinding.detail &&
    requestedFinding.selectedByDefault === scannedFinding.selectedByDefault
  )
}

function normalizePathForComparison(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}
