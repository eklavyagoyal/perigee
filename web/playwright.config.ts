import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cachedBrowser = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell');

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: '1', PIPELINE_API_URL: '', PIPELINE_CONTROL_TOKEN: '', NEXT_PUBLIC_SCENE_MANIFEST: '' },
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PERIGEE_CHROMIUM || (existsSync(cachedBrowser) ? cachedBrowser : undefined),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
});
