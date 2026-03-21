import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSearchTokens, isPathWithinRoot, normalizeForSearch } from '@main/services/cleanup/helpers'

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

    expect(isPathWithinRoot(inside, root)).toBe(true)
    expect(isPathWithinRoot(outside, root)).toBe(false)
  })
})
