import { defineConfig, devices } from '@playwright/test';

export const PORTS = { upstream: 9101, proxy: 9102, web: 9103 };

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTS.web}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx e2e/fakeUpstream.ts',
      url: `http://localhost:${PORTS.upstream}/health`,
      env: { PORT: String(PORTS.upstream) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx tsx server/index.ts',
      url: `http://localhost:${PORTS.proxy}/health`,
      env: {
        PORT: String(PORTS.proxy),
        UPSTREAM_WS_HOST: `ws://localhost:${PORTS.upstream}`,
        UPSTREAM_API_HOST: `http://localhost:${PORTS.upstream}`,
        KLINES_TTL_MS: '1000',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite --port ${PORTS.web} --strictPort`,
      url: `http://localhost:${PORTS.web}`,
      env: {
        VITE_WS_HOST: `ws://localhost:${PORTS.proxy}`,
        VITE_API_HOST: `http://localhost:${PORTS.proxy}`,
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
