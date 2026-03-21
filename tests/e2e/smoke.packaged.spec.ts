import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { expectVisibleShell, launchPackagedApp } from './helpers/packagedApp'

const releaseManifestPath = path.join(process.cwd(), 'release', 'build-manifest.json')

function readBuildLabel(): string {
  const manifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8')) as { buildLabel: string }
  return manifest.buildLabel
}

test.describe('packaged smoke checks', () => {
  test('boots through preload and renders the dashboard shell', async () => {
    const app = await launchPackagedApp({
      fixture: 'queue-populated',
      port: 9341,
      width: 1400,
      height: 920
    })

    try {
      await expectVisibleShell(app.page)
      await expect(app.page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'desktop')
      expect(await app.page.evaluate(() => typeof window.wsaApi === 'object')).toBe(true)
      await expect(app.page.getByText('Loading WSA Manager...')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('slow readiness does not block the shell and eventually surfaces timeout state', async () => {
    const app = await launchPackagedApp({
      fixture: 'slow-readiness',
      port: 9342,
      width: 1400,
      height: 920
    })

    try {
      await expectVisibleShell(app.page)
      await expect(app.page.getByRole('button', { name: 'Setup Wizard' })).toBeVisible()
      await expect(app.page.getByTestId('boot-error-chip')).toContainText('Readiness check timed out', {
        timeout: 20_000
      })
    } finally {
      await app.close()
    }
  })

  test('can navigate across the primary views in the packaged build', async () => {
    const app = await launchPackagedApp({
      fixture: 'queue-populated',
      port: 9343,
      width: 1400,
      height: 920
    })

    try {
      await expectVisibleShell(app.page)
      await app.page.getByTestId('nav-apps').click()
      await expect(app.page.getByRole('heading', { name: 'Installed Apps' })).toBeVisible()
      await app.page.getByTestId('nav-cleanup').click()
      await expect(app.page.getByRole('heading', { name: 'Cleanup' })).toBeVisible()
      await app.page.getByTestId('nav-diag').click()
      await expect(app.page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible()
      await expect(app.page.getByTestId('diagnostics-build-label')).toContainText(readBuildLabel())
    } finally {
      await app.close()
    }
  })
})
