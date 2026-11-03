import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: process.env.STATIC_PREVIEW === '1' ? {
    command: 'python tests/static-preview.py',
    url: 'http://127.0.0.1:8081/preview/',
    reuseExistingServer: false,
  } : undefined,
  testDir: './tests/browser',
  timeout: 90000,
  expect: { timeout: 60000 },
  workers: 1,
  use: {
    baseURL: process.env.TEST_URL || (process.env.STATIC_PREVIEW === '1' ? 'http://127.0.0.1:8081/preview/' : 'http://127.0.0.1:5173'),
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] },
  },
});
