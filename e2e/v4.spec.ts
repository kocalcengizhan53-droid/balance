import { expect, test } from "./fixtures"

/**
 * The three views that show the same solve in new shapes: the energy flow on the overview, the
 * price surface on the market, the fleet as cards. Each is driven the way a visitor would, and
 * each is checked against the state the rest of the page reads.
 */

test("the flow shows where the power goes and follows a trip", async ({
  page,
}) => {
  await page.goto("/?t=38")
  const flow = page.getByRole("region", { name: "Where the power goes" })
  await flow.scrollIntoViewIfNeeded()
  const picture = flow.getByRole("img")
  await expect(picture).toHaveAttribute("aria-label", /Nuclear 1,180 MW/)

  // The readout names the fuel under the pointer.
  await picture.getByText("Gas", { exact: true }).hover()
  await expect(flow.locator('[aria-live="polite"]')).toContainText(
    /Gas · [\d,]+ MW · \d+% of supply · via Central/
  )

  await page
    .getByRole("region", { name: "System frequency" })
    .getByRole("button", { name: "Trip Hartmoor" })
    .click()
  await expect(picture).not.toHaveAttribute("aria-label", /Nuclear/)
})

test("a cell on the price surface moves the lever and the clock", async ({
  page,
}) => {
  await page.goto("/market?t=10")
  const surface = page.getByRole("region", { name: "Price surface" })
  await surface.scrollIntoViewIfNeeded()

  // Keyboard: from the ringed cell (wind 100%, 05:00), one row down and two half-hours on.
  const grid = surface.getByRole("group", { name: /Price surface by wind/ })
  await grid.focus()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await expect(surface.locator('[aria-live="polite"]')).toContainText(
    "wind at 80% · 06:00"
  )
  await page.keyboard.press("Enter")
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.scenario.windScale))
    .toBe(0.8)
  expect(await page.evaluate(() => window.__app?.state.period)).toBe(12)

  // Another lever re-solves the surface along its own range.
  await surface.getByRole("button", { name: "Carbon" }).click()
  await expect(surface.locator("svg text").first()).toHaveText("£150/t")
})

test("the fleet opens on its cards, and a card trips its unit", async ({
  page,
}) => {
  await page.goto("/fleet?t=20")
  const card = page.getByRole("listitem").filter({ hasText: "Hartmoor" })
  await expect(card).toContainText("1,180")
  await card.getByRole("button", { name: "Take Hartmoor offline" }).click()
  await expect(card).toContainText("offline")
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline))
    .toEqual(["hartmoor"])
  await card.getByRole("button", { name: "Return Hartmoor to service" }).click()
  await expect(card).toContainText("running")

  await card.getByRole("button", { name: /^Hartmoor: .*Open details/ }).click()
  await expect(page.getByRole("dialog")).toContainText("Hartmoor")
})
