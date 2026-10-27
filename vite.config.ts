import { resolve } from "node:path"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

import { routePreload } from "./scripts/route-preload.js"

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // The lazy routes in src/router.ts, by URL.
    routePreload({
      "/fleet": "src/features/fleet/FleetPage.tsx",
      "/market": "src/features/market/MarketPage.tsx",
      "/scenarios": "src/features/scenarios/ScenariosPage.tsx",
      "/audit": "src/features/audit/AuditPage.tsx",
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // The 3D scene is one lazy chunk of about a megabyte (three, fiber, drei, postprocessing),
    // loaded only on a desktop once the page is idle, or on a phone when asked. Everything a
    // visitor needs to see the overview is in the much smaller entry chunk.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    projects: [
      {
        // The grid model is pure arithmetic and belongs in a fast node project.
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // The API's handlers against the real schema, over Node's built-in SQLite.
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
})
