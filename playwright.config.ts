import { defineConfig, devices } from "@playwright/test"

const PORT = 4173

export default defineConfig({
  testDir: "e2e",
  outputDir: "qa-output/results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "qa-output/report", open: "never" }],
  ],

  use: {
    baseURL: process.env.QA_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // The acceptance run drives the production bundle. Set QA_BASE_URL to point at a server
  // that is already running — `npm run qa:dev` does that against vite dev on :5173.
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        // Always build fresh: a preview server started without VITE_QA_HOOK has no window.__app.
        reuseExistingServer: false,
        timeout: 180_000,
        env: { ...process.env, VITE_QA_HOOK: "true" } as Record<string, string>,
      },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
})
