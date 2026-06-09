/* global process */
import fs from 'fs';
import { defineConfig, devices } from '@playwright/test';

// Load E2E credentials from the gitignored .env.local / .env into process.env,
// without adding a dotenv dependency. .env.local takes precedence (read first;
// the guard below keeps the first value set). Real env vars (e.g. CI secrets)
// always win. These are read by the Node test process only — they are NOT
// VITE_-prefixed, so they are never bundled into the browser.
for (const file of ['.env.local', '.env']) {
  try {
    const contents = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    for (const line of contents.split('\n')) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // File absent — fine.
  }
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'list',
  use: {
    // In CI, E2E_BASE_URL points at the deployed app; locally we use the dev server.
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices.desktop_chrome },
    },
  ],

  // Only start a local dev server when NOT targeting a remote app. When
  // E2E_BASE_URL is set (e.g. CI → deployed production app), tests run against it
  // directly with no local build or server.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
        },
      }),
});
