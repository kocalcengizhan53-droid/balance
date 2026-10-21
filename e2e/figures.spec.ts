import type { Page } from "@playwright/test"

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
 * The one rule, checked where it can actually be broken.
 *
 * Every figure on this page is supposed to be solved from `src/lib/grid/`, with nothing typed
 * into a component. A unit test cannot see that: it can only check the solver, and the solver
 * was never the thing at risk. So the browser re-solves the day from the view's own inputs and
 * compares the result with the text actually painted. A tile that hardcoded a number, rounded
 * the wrong way, or kept reading a stale solution fails here and nowhere else.
 */

const figure = (page: Page, name: string) =>
  page.locator(`[data-figure^="${name}"]`)

async function solved(page: Page) {
  return page.evaluate(() => {
    const app = window.__app
    if (!app)
      throw new Error("window.__app missing — build without VITE_QA_HOOK?")
    const { offline, period } = app.state
    const p = app.solve(offline).periods[period]
    return {
      period,
      demand: p.demand,
      price: p.price,
      carbon: p.carbonIntensity,
      link: p.interconnector,
      marginalUnit: p.marginalUnit,
      headroom: p.outputs.reduce((s, o) => s + (o.available - o.mw), 0),
      generation: p.outputs.reduce((s, o) => s + o.mw, 0),
      outputs: p.outputs.map((o) => ({
        name: o.unit.name,
        mw: Math.round(o.mw),
        capacity: o.unit.capacity,
      })),
    }
  })
}

/** The fleet page's rows, against the same solve. */
async function expectFleetAgreement(page: Page, mobile: boolean) {
  const s = await solved(page)
  await toPage(page, "Fleet", mobile)
  for (const unit of s.outputs) {
    const row = await rowFor(page, unit.name)
    await expect(row).toContainText(String(unit.mw.toLocaleString("en-GB")))
    await expect(row).toContainText(unit.capacity.toLocaleString("en-GB"))
  }
}

async function expectAgreement(page: Page) {
  const s = await solved(page)

  await expect(figure(page, "Carbon intensity")).toContainText(
    String(Math.round(s.carbon))
  )
  await expect(figure(page, "Carbon intensity")).toContainText(s.marginalUnit)
  await expect(figure(page, "Demand")).toContainText(
    (s.demand / 1000).toFixed(2)
  )
  await expect(figure(page, "Price")).toContainText(`£${Math.round(s.price)}`)
  await expect(figure(page, "Price")).toContainText(s.marginalUnit)
  await expect(figure(page, "Interconnector")).toContainText(
    Math.abs(Math.round(s.link)).toLocaleString("en-GB")
  )
  await expect(figure(page, "Interconnector")).toContainText(
    s.link >= 0 ? /importing/i : /exporting/i
  )
  await expect(figure(page, "Spare capacity")).toContainText(
    Math.round(s.headroom).toLocaleString("en-GB")
  )
  await expect(figure(page, "Demand")).toContainText(
    Math.round(s.generation).toLocaleString("en-GB")
  )

  // The diagram says the same thing in its accessible name, which is what a screen reader
  // is handed in place of the drawing.
  await expect(
    page.getByRole("img", { name: /single-line diagram/ }).last()
  ).toHaveAttribute(
    "aria-label",
    new RegExp(`Demand ${Math.round(s.demand)} megawatts`)
  )
}

test("the tiles, the diagram and the fleet table all show the solver's numbers", async ({
  page,
}) => {
  await page.goto("/")
  await expectAgreement(page)
})

test("they still agree after the period changes", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("slider", { name: /Time/ }).fill("12")
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.period))
    .toBe(12)
  await expectAgreement(page)
})

test("the fleet table shows the solver's numbers, row by row", async ({
  page,
}, info) => {
  await page.goto("/")
  await expectFleetAgreement(page, info.project.name === "mobile")
})

test("they still agree with two units offline", async ({ page }) => {
  await page.goto("/")
  for (const name of ["Calder A", "Calder B"]) {
    await diagram(page)
      .getByRole("button", { name: new RegExp(`^${name}, \\d`) })
      .click()
  }
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline.length))
    .toBe(2)
  await expectAgreement(page)
})
