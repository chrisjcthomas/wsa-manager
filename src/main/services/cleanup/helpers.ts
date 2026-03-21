import path from 'node:path'
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
  const resolvedCandidate = path.resolve(candidatePath)
  const resolvedRoot = path.resolve(rootPath)
  return resolvedCandidate.startsWith(resolvedRoot)
}
