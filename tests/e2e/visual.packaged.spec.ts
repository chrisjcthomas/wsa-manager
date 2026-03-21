import { expect, test, type Page } from '@playwright/test'
import { launchPackagedApp } from './helpers/packagedApp'

const screenshotOptions = {
  scale: 'css' as const
}

async function closeSetupWizardIfVisible(page: Page) {
  const closeButton = page.getByTestId('setup-close-button')
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  }
}

async function expectNoPrimaryScroll(page: Page) {
  const metrics = await page.getByTestId('workspace-scroll-root').evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  }))

  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 2)
}

async function waitForSettledReadiness(page: Page) {
  await page.waitForTimeout(2_000)
  await page.waitForFunction(() => !document.body.innerText.includes('Checking device state'), undefined, {
    timeout: 15_000
  })
  await page.waitForTimeout(250)
}

test.describe('packaged visual baselines', () => {
  test('captures setup and empty-queue states at desktop size', async () => {
    const app = await launchPackagedApp({
      fixture: 'baseline',
      port: 9351,
      width: 1400,
      height: 920
    })

    try {
      await expect(app.page.getByTestId('setup-sheet')).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('setup-wizard-open-1400x920.png', {
        ...screenshotOptions,
        maxDiffPixels: 500
      })
      await app.page.getByTestId('setup-close-button').click()
      await expect(app.page.getByTestId('queue-empty-state')).toBeVisible()
      await expectNoPrimaryScroll(app.page)
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('install-empty-1400x920.png', screenshotOptions)
    } finally {
      await app.close()
    }
  })

  test('captures compact empty-queue layout', async () => {
    const app = await launchPackagedApp({
      fixture: 'baseline',
      port: 9352,
      width: 1060,
      height: 740
    })

    try {
      await expect(app.page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'compact')
      await expect(app.page.getByTestId('sidebar')).toHaveAttribute('data-compact', 'true')
      await closeSetupWizardIfVisible(app.page)
      await expect(app.page.getByTestId('queue-empty-state')).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('install-empty-1060x740.png', screenshotOptions)
    } finally {
      await app.close()
    }
  })

  test('captures minimum supported empty-queue layout', async () => {
    const app = await launchPackagedApp({
      fixture: 'baseline',
      port: 9353,
      width: 920,
      height: 640
    })

    try {
      await expect(app.page.getByTestId('app-shell')).toHaveAttribute('data-layout', 'narrow')
      await expect(app.page.getByTestId('sidebar')).toHaveAttribute('data-compact', 'true')
      await closeSetupWizardIfVisible(app.page)
      await expect(app.page.getByTestId('queue-empty-state')).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('install-empty-920x640.png', screenshotOptions)
    } finally {
      await app.close()
    }
  })

  test('captures queue-populated dashboard and library views', async () => {
    const app = await launchPackagedApp({
      fixture: 'queue-populated',
      port: 9354,
      width: 1400,
      height: 920
    })

    try {
      await expect(app.page.getByText('Spotify.apk')).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('install-queue-1400x920.png', screenshotOptions)
      await app.page.getByTestId('nav-apps').click()
      await expect(app.page.getByRole('heading', { name: 'Installed Apps' })).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('installed-apps-1400x920.png', screenshotOptions)
      await app.page.getByTestId('nav-cleanup').click()
      await expect(app.page.getByRole('heading', { name: 'Cleanup' })).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('cleanup-1400x920.png', screenshotOptions)
      await app.page.getByTestId('nav-diag').click()
      await expect(app.page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible()
      await waitForSettledReadiness(app.page)
      await expect(app.page).toHaveScreenshot('diagnostics-1400x920.png', {
        ...screenshotOptions,
        mask: [app.page.getByTestId('diagnostics-build-label')]
      })
    } finally {
      await app.close()
    }
  })
})
