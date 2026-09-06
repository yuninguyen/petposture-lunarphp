import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: ['--host-resolver-rules=MAP petposture.com 127.0.0.1'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run start -- -p 3101',
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: 'https://api.petposture.com',
    },
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
