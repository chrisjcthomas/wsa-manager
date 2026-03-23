import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSearchTokens, isMatchingCleanupFinding, isPathWithinRoot, normalizeForSearch } from '@main/services/cleanup/helpers'

describe('cleanup helpers', () => {
  it('normalizes search strings for filename matching', () => {
    expect(normalizeForSearch('APKMirror Installer (beta).lnk')).toBe('apkmirrorinstallerbetalnk')
  })

  it('builds package and label search tokens', () => {
    expect(buildSearchTokens('com.fidloo.cinexplore', 'Cinexplore')).toEqual(
      expect.arrayContaining(['comfidloocinexplore', 'cinexplore'])
    )
  })

  it('keeps cleanup file deletes inside known roots', () => {
    const root = path.join('C:\\', 'Users', 'cobek', 'Desktop')
    const inside = path.join(root, 'Cinexplore.lnk')
    const outside = path.join('C:\\', 'Windows', 'system32', 'cmd.exe')
    const prefixBypass = path.join('C:\\', 'Users', 'cobek', 'DesktopBackup', 'Cinexplore.lnk')

    expect(isPathWithinRoot(inside, root)).toBe(true)
    expect(isPathWithinRoot(outside, root)).toBe(false)
    expect(isPathWithinRoot(prefixBypass, root)).toBe(false)
  })

  it('matches cleanup findings exactly before allowing removal', () => {
    const scannedFinding = {
      id: 'com.fidloo.cinexplore:desktop:0',
      packageName: 'com.fidloo.cinexplore',
      label: 'Cinexplore',
      artifactType: 'desktop_shortcut' as const,
      target: 'C:\\Users\\cobek\\Desktop\\Cinexplore.lnk',
      locationLabel: 'Desktop',
      detail: 'Cinexplore.lnk',
      selectedByDefault: true
    }

    expect(isMatchingCleanupFinding(scannedFinding, scannedFinding)).toBe(true)
    expect(
      isMatchingCleanupFinding(
        {
          ...scannedFinding,
          target: 'C:\\Users\\cobek\\DesktopBackup\\Cinexplore.lnk'
        },
        scannedFinding
      )
    ).toBe(false)
  })
})
