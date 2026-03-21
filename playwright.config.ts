import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: path.join(__dirname, 'tests', 'e2e'),
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  snapshotPathTemplate: '{testDir}\\__screenshots__\\{testFilePath}\\{arg}{ext}',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 10_000
  }
})
