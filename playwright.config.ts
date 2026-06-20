import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/unit/**",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  timeout: 30_000,
  // One retry in CI absorbs residual external flakiness (e.g. third-party map
  // tiles); locally a failure should fail loudly so it gets fixed, not masked.
  retries: process.env.CI ? 1 : 0,
  workers: 1, // run serially — tests share a local dev DB
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    // Capture a trace on the retried attempt so CI failures are debuggable
    // without reproducing locally.
    trace: "on-first-retry",
    video: "off",
    headless: true,
  },

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },

  projects: [
    // Logs in alice + sam once and saves their session cookies to tests/.auth/.
    // Authenticated specs reuse those via `test.use({ storageState })` instead
    // of driving the login form in every test. Runs after the webServer is up.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
