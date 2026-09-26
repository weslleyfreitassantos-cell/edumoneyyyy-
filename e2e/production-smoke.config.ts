import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PROD_SMOKE_BASE_URL;
const users = process.env.PROD_SMOKE_USERS_JSON;

if (!baseURL || new URL(baseURL).protocol !== 'https:') {
  throw new Error('Set PROD_SMOKE_BASE_URL to the HTTPS URL of the dedicated pilot environment.');
}
if (process.env.PROD_SMOKE_CONFIRM_PILOT_TENANT !== 'I_CONFIRM_DEDICATED_PILOT') {
  throw new Error('Production smoke is gated: confirm a dedicated pilot tenant with PROD_SMOKE_CONFIRM_PILOT_TENANT.');
}
if (!users) {
  throw new Error('Set PROD_SMOKE_USERS_JSON with pilot users; credentials are never stored in the repository.');
}

export default defineConfig({
  testDir: '.',
  testMatch: 'production-smoke.pw.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: 'line',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    ...devices['Desktop Chrome'],
    // Pilot credentials must not be retained in screenshots, traces, or video.
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
});
