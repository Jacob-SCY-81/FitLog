import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ignoreHTTPSErrors: true,
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: path.resolve(__dirname, '../server'),
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        SMS_DEV_LOG_FILE: path.resolve(__dirname, '../scratch/dev-sms-e2e.log'),
      },
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
