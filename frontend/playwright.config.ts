import { defineConfig } from '@playwright/test'

// Isolated stack: backend on 8011 with a throwaway database, built frontend on 4173.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Set PW_CHROMIUM_PATH to reuse an existing Chromium instead of `npx playwright install chromium`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      command: 'rm -f /tmp/cva-e2e.sqlite3 && cd ../backend && CVA_DB_PATH=/tmp/cva-e2e.sqlite3 .venv/bin/uvicorn app.main:app --port 8011',
      url: 'http://127.0.0.1:8011/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && CVA_API=http://127.0.0.1:8011 npx vite preview',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
