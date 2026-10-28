/**
 * Renders the phone's day video: the region through all 48 half-hours, 0.72 s each like the
 * clock, one per theme. The scene is stepped exactly one frame at a time (`?capture` stops its
 * own loop), so the turbines turn and the pulses run at their real speed however long each
 * screenshot takes.
 *
 *   npm run build && npx vite preview --port 4180 &
 *   FFMPEG=/path/to/ffmpeg QA_URL=http://localhost:4180 npm run scene-video
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "@playwright/test"

const BASE = (process.env.QA_URL ?? "http://localhost:4180").replace(/\/$/, "")
const FFMPEG = process.env.FFMPEG ?? "ffmpeg"
const OUT = new URL("../public/", import.meta.url).pathname
const FPS = 25
const PER_PERIOD = 18 // 0.72 s at 25 fps, the clock's tick

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-gl=angle", "--use-angle=metal"],
})
for (const theme of process.env.THEMES?.split(",") ?? ["dark", "light"]) {
  const frames = mkdtempSync(join(tmpdir(), `scene-${theme}-`))
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
  })
  const page = await context.newPage()
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
  await page.goto(`${BASE}/?capture`, { waitUntil: "load" })
  await page.getByRole("button", { name: "Explore in 3D" }).click()
  await page.waitForFunction(() => window.__scene, null, { timeout: 120_000 })
  // Three seconds of warm-up: the camera settles and the materials compile before frame one.
  for (let i = 0; i < 75; i++)
    await page.evaluate(() => window.__scene.step(1 / 25))
  await page.waitForSelector('[data-scene="live"]', { timeout: 60_000 })
  // The labels, the page title and the instruments are drawn over the video by the page.
  await page.addStyleTag({
    content: `[data-poster-hide], [role="group"][aria-label="Plants in the region"], [data-scene] > img, [data-scene] > video { visibility: hidden !important; }`,
  })
  // The live scene fades in over the poster in real time (700 ms), however fast it is stepped.
  await page.waitForTimeout(1200)
  const stage = page.locator("[data-scene]")
  let n = 0
  for (let period = 0; period < 48; period++) {
    await page.evaluate((p) => window.__scene.setPeriod(p), period)
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r))
        )
    )
    for (let k = 0; k < PER_PERIOD; k++) {
      await page.evaluate((dt) => window.__scene.step(dt), 1 / FPS)
      await stage.screenshot({
        path: join(frames, `f${String(n++).padStart(4, "0")}.png`),
      })
    }
    if (period % 12 === 0)
      console.log(`${theme}: ${String(period).padStart(2)} / 48`)
  }
  await context.close()

  const file = join(OUT, `scene-${theme}-tall.mp4`)
  execFileSync(FFMPEG, [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(FPS),
    "-i",
    join(frames, "f%04d.png"),
    "-vf",
    "scale=640:-2:flags=lanczos",
    "-c:v",
    "libx264",
    "-preset",
    "slower",
    "-crf",
    process.env.CRF ?? "28",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    file,
  ])
  console.log(
    `${file} ${(statSync(file).size / 1024).toFixed(0)} KB, ${n} frames`
  )
}
await browser.close()
