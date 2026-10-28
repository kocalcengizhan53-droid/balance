import { expect, test } from "./fixtures"

/**
 * The dashboard moves before anyone touches it, and stops when they do.
 *
 * A test browser announces itself (`navigator.webdriver`) and the day stays still for it, so
 * every other spec reads a fixed half-hour. Here the flag is hidden, as it is for a visitor.
 */
test.describe("a visitor's first seconds", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() =>
      Object.defineProperty(navigator, "webdriver", { get: () => false })
    )
  })

  test("the day plays by itself, and the first click stops it", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/play=1/, { timeout: 8000 })
    const start = await page.evaluate(() => window.__app?.state.period)
    await expect
      .poll(() => page.evaluate(() => window.__app?.state.period))
      .not.toBe(start)
    await expect(
      page.getByRole("button", { name: "Pause the day" })
    ).toBeVisible()

    // Any click will do; this one lands on a panel heading, away from every control.
    await page.getByRole("heading", { name: "Generation mix" }).click()
    await expect(
      page.getByRole("button", { name: "Play the day" })
    ).toBeVisible()
    // Stopped, the link names the half-hour it stopped on, so it can be sent.
    await expect(page).toHaveURL(/t=\d+/)
    await expect(page).not.toHaveURL(/play=1/)
  })

  test("a link that names a half-hour stays on it", async ({ page }) => {
    await page.goto("/?t=12")
    await page.waitForTimeout(3500)
    expect(await page.evaluate(() => window.__app?.state.period)).toBe(12)
    await expect(
      page.getByRole("button", { name: "Play the day" })
    ).toBeVisible()
  })
})

test("tripping a plant replays the frequency it caused", async ({ page }) => {
  await page.goto("/")
  const panel = page.getByRole("region", { name: "System frequency" })
  const trip = panel.getByRole("button", { name: /^Trip / })
  const unit = (await trip.textContent())!.replace(/^Trip /, "").trim()
  await trip.click()

  // The announcement carries the solved transient: the loss, the nadir, any demand shed.
  const said = panel.locator('[aria-live="polite"]')
  await expect(said).toContainText(`${unit} tripped`)
  await expect(said).toContainText(/fell to 4\d\.\d\d hertz/)
  await expect(panel.getByText(/Hz at \d+\.\d s/)).toBeVisible({
    timeout: 8000,
  })
  const nadir = Number(
    (await panel
      .getByText(/^4\d\.\d\d Hz$/)
      .first()
      .textContent())!.split(" ")[0]
  )
  expect(nadir).toBeLessThan(50)

  // And the unit really is out: the same state every other instrument reads.
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline.length))
    .toBe(1)
  await panel.getByRole("button", { name: "Restore all" }).click()
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline.length))
    .toBe(0)
})
