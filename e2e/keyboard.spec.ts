import { expect, test } from "./fixtures"

/** The fleet table is paged and sorted by output, so a unit that was taken out is on the last page. */
async function rowFor(page: import("@playwright/test").Page, name: string) {
  const row = page.getByRole("row", { name: new RegExp(`\\b${name}\\b`) })
  const prev = page.getByRole("button", { name: "Previous page" })
  while (!(await prev.isDisabled())) await prev.click()
  for (let i = 0; i < 3; i++) {
    if ((await row.count()) > 0) return row
    const next = page.getByRole("button", { name: "Next page" })
    if (await next.isDisabled()) break
    await next.click()
  }
  return row
}

/** Navigate the way a visitor does — by the rail — so the view's state comes along. */
async function toPage(
  page: import("@playwright/test").Page,
  name: string,
  mobile: boolean
) {
  if (mobile)
    await page.getByRole("button", { name: /toggle sidebar/i }).click()
  await page.getByRole("link", { name, exact: true }).first().click()
  await page.getByRole("heading", { level: 1, name }).waitFor()
}

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
}, info) => {
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
  if (info.project.name !== "mobile")
    expect(
      reached.some((r) => /^a Fleet/.test(r)),
      "the rail"
    ).toBe(true)
  expect(
    reached.some(
      (r) => /^input/.test(r) && /Carbon|Demand|Wind|^input $/.test(r)
    ) || reached.filter((r) => /^input/.test(r)).length >= 2,
    "the levers"
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
  await toPage(page, "Fleet", info.project.name === "mobile")
  await expect(await rowFor(page, "Hartmoor")).toContainText("offline")
})

test("Enter on a diagram row takes the unit offline", async ({
  page,
}, info) => {
  await page.goto("/")
  const row = diagram(page).getByRole("button", { name: /^Hartmoor, \d/ })
  await row.press("Enter")

  await expect(row).toHaveAttribute("aria-pressed", "true")
  await toPage(page, "Fleet", info.project.name === "mobile")
  await expect(await rowFor(page, "Hartmoor")).toContainText("offline")
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
