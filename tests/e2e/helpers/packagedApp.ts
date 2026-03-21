import path from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

interface LaunchPackagedAppOptions {
  fixture: string
  port: number
  width: number
  height: number
}

interface PackagedAppHandle {
  browser: Browser
  page: Page
  close: () => Promise<void>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..', '..')
const executablePath = path.join(projectRoot, 'release', 'win-unpacked', 'WSA Manager.exe')

async function waitForCdpEndpoint(port: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/json/version`
  const startedAt = Date.now()

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Retry until the timeout expires.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for Electron CDP endpoint on port ${port}.`)
}

async function waitForPage(browser: Browser): Promise<Page> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < 20_000) {
    for (const context of browser.contexts()) {
      const matchingPage = context.pages().find((page) => page.url().includes('index.html'))
      if (matchingPage) {
        return matchingPage
      }
    }

    await delay(250)
  }

  throw new Error('Timed out waiting for the Electron renderer page.')
}

async function killProcessTree(pid: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    })

    killer.on('exit', () => resolve())
    killer.on('error', () => resolve())
  })
}

export async function launchPackagedApp(options: LaunchPackagedAppOptions): Promise<PackagedAppHandle> {
  const child = spawn(
    executablePath,
    [
      `--remote-debugging-port=${options.port}`,
      `--harness-fixture=${options.fixture}`,
      `--window-width=${options.width}`,
      `--window-height=${options.height}`,
      '--disable-gpu'
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        WSA_MANAGER_FIXTURE: options.fixture
      }
    }
  )

  child.unref()
  await waitForCdpEndpoint(options.port)

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${options.port}`)
  const page = await waitForPage(browser)
  await page.waitForLoadState('domcontentloaded')
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `
  })

  return {
    browser,
    page,
    close: async () => {
      await browser.close()
      await killProcessTree(child.pid ?? 0)
    }
  }
}

export async function expectVisibleShell(page: Page): Promise<void> {
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}
