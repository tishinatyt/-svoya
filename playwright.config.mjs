import { defineConfig, devices } from '@playwright/test';
import { localStack } from './scripts/local-stack.mjs';

// No environment override or production URL: browser tests use this disposable stack only.
const stack = localStack();
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 15_000,
    baseURL: 'http://127.0.0.1:5173',
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'off', // Do not persist email confirmation or recovery tokens.
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone SE'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/-svoya/',
    reuseExistingServer: false,
    env: {
      VITE_SVOYA_ENV: 'test',
      VITE_SUPABASE_URL: stack.API_URL,
      VITE_SUPABASE_ANON_KEY: stack.ANON_KEY,
      VITE_BASE_PATH: '/-svoya/',
    },
  },
});
