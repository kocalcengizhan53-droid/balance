/**
 * Renders the overview's scene to the pictures the stage shows before the live scene loads —
 * one per theme, one wide (desktop) and one tall (phone) — straight from the scene itself, so the
 * picture and the model never drift apart.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npm run posters            # writes public/scene-{dark,light}-{wide,tall}.webp
 *
 * Chrome draws the scene in software here (SwiftShader), which is slow but deterministic and
 * needs no GPU. cwebp must be on the PATH.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "@playwright/test"

const BASE = process.env.POSTER_BASE_URL ?? "http://localhost:4173"
const OUT = new URL("../public/", import.meta.url).pathname
const tmp = mkdtempSync(join(tmpdir(), "posters-"))

const SHAPES = {
  wide: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 },
  tall: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
for (const [shape, options] of Object.entries(SHAPES)) {
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({ ...options, colorScheme: theme })
    const page = await context.newPage()
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`${BASE}/`, { waitUntil: "load" })
    const explore = page.getByRole("button", { name: "Explore in 3D" })
    if (await explore.isVisible().catch(() => false)) await explore.click()
    await page.waitForSelector('[data-scene="live"]', { timeout: 120_000 })
    // The labels, the page title and the instruments are drawn over the picture by the page.
    await page.addStyleTag({
      content: `[data-poster-hide], [role="group"][aria-label="Plants in the region"], [data-scene] > img { visibility: hidden !important; }`,
    })
    await page.waitForTimeout(2500)
    const png = join(tmp, `scene-${theme}-${shape}.png`)
    await page.locator("[data-scene]").screenshot({ path: png, omitBackground: false })
    const webp = join(OUT, `scene-${theme}-${shape}.webp`)
    execFileSync("cwebp", ["-quiet", "-q", "78", "-m", "6", png, "-o", webp])
    console.log(`wrote ${webp}`)
    await context.close()
  }
}
await browser.close()
