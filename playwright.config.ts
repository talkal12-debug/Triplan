import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the dev server.
 * Usage: npm run test:e2e   (starts `next dev` on port 3000 unless one is already running)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  // Dev-mode compiles can be slow on first hit; keep the dev server to one client at a time.
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "he-IL",
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    // Wait for the wizard route itself so Turbopack has compiled it before the first test.
    url: "http://localhost:3000/he/plan/destination",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
