import { expect, test } from "./fixtures"

/** The single-line diagram: the one place a unit's control stands still. */
const diagram = (page: import("@playwright/test").Page) =>
  page
    .locator("figure", { has: page.getByText("Where it is coming from") })
    .last()

/**
 * Reached by Tab from the top of the document, not by calling focus().
 *
 * An element that only script can focus is not reachable by a reader, and a control in an SVG
 * is the easiest kind to get wrong — the diagram's rows are <g> elements and are only
 * operable because they say so.
 */
test("Tab from the top reaches the theme switch, the diagram and the fleet", async ({
  page,
}) => {
  await page.goto("/")
  await page.locator("body").click({ position: { x: 2, y: 2 } })

  const reached: string[] = []
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab")
    reached.push(
      await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return ""
        return [
          el.tagName.toLowerCase(),
          el.getAttribute("aria-label") ??
            el.textContent?.trim().slice(0, 30) ??
            "",
        ].join(" ")
      })
    )
  }

  expect(
    reached.some((r) => /dark|light/i.test(r)),
    "the theme switch"
  ).toBe(true)
  expect(
    reached.some((r) => /^g Hartmoor, /.test(r)),
    "a diagram row"
  ).toBe(true)
  expect(
    reached.some((r) => /^input/.test(r)),
    "the time scrubber"
  ).toBe(true)
  expect(
    reached.some((r) => /^button Play the day/.test(r)),
    "the play control"
  ).toBe(true)
  expect(
    reached.some((r) => /^button Hartmoor ?Nuclear/.test(r)),
    "a fleet row"
  ).toBe(true)
})

test("the plant's own label in the scene takes it offline too", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "the scene hides its labels on a phone"
  )
  await page.goto("/")
  const pill = page.getByRole("button", { name: /^Hartmoor, \d/ }).first()
  await pill.click({ force: true })
  await expect(pill).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("row", { name: /^Hartmoor\b/ })).toContainText(
    "offline"
  )
})

test("Enter on a diagram row takes the unit offline", async ({ page }) => {
  await page.goto("/")
  const row = diagram(page).getByRole("button", { name: /^Hartmoor, \d/ })
  await row.press("Enter")

  await expect(row).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("row", { name: /^Hartmoor\b/ })).toContainText(
    "offline"
  )
})

test("the arrow keys walk the day half-hour by half-hour", async ({ page }) => {
  await page.goto("/")
  const scrubber = page.getByRole("slider", { name: /Time/ })
  await scrubber.focus()
  await expect(scrubber).toHaveValue("36")

  await scrubber.press("ArrowRight")
  await expect(scrubber).toHaveValue("37")
  await expect(page.getByText(/Settlement period 0?38 of 48/)).toBeVisible()

  await scrubber.press("Home")
  await expect(scrubber).toHaveValue("0")
  await expect(page.getByText(/Settlement period 0?1 of 48/)).toBeVisible()
})
