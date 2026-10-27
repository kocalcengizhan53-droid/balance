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
    baseURL: process.env.QA_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    /*
     * A CI runner has no GPU. Chrome then draws the WebGL scene in software, and a 3D region
     * with shadows and seven hundred particles at the display rate takes the whole CPU with
     * it — every click waited thirty seconds and timed out. With WebGL off the page shows the
     * single-line diagram in the scene's place, which is the product's own fallback, and the
     * suite drives everything else as a visitor would. The scene's own checks run locally,
     * where there is a GPU.
     */
    launchOptions: process.env.CI
      ? { args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"] }
      : undefined,
  },

  // The acceptance run drives the production bundle with its API: Pages Functions over a local D1
  // database, as deployed. Set QA_BASE_URL to point at a server that is already running —
  // `npm run qa:dev` does that against vite dev on :5173, where the API is absent.
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command:
          `npm run build && npx wrangler d1 migrations apply balance-db --local` +
          ` && npx wrangler pages dev dist --port ${PORT} --ip 127.0.0.1 --binding SIGN_INS_PER_IP=1000`,
        url: `http://127.0.0.1:${PORT}`,
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
