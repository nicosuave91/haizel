import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", 
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "pnpm --filter web-app-react dev -- --host 127.0.0.1 --port 4173",
    cwd: "../..",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe"
  }
});
