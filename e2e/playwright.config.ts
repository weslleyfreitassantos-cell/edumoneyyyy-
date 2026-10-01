import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configure as variáveis Supabase locais antes do E2E.');
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['line'], ['html', { outputFolder: '.runtime/report', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  },
});
