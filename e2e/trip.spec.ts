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
 * What the dashboard is for: taking plant out and watching the system answer.
 *
 * The figures are checked against the solver elsewhere. What is checked here is the direction
 * of the answer — that removing 1.8 GW of gas makes the remaining megawatts dearer and
 * cleaner, that the system says so out loud when it can no longer meet demand, and that the
 * page can be put back.
 */
test("taking the two largest gas stations out raises the price, cuts carbon, and declares the shortfall", async ({
  page,
}, info) => {
  await page.goto("/")

  const price = page.locator('[data-figure^="Price"] .lit')
  const carbon = page.locator('[data-figure^="Carbon intensity"] .lit')
  const before = {
    price: Number((await price.innerText()).match(/£(\d+)/)?.[1]),
    carbon: Number((await carbon.innerText()).match(/(\d+)/)?.[1]),
  }
  await expect(page.getByRole("alert")).toHaveCount(0)

  for (const name of ["Calder A", "Calder B"]) {
    await diagram(page)
      .getByRole("button", { name: new RegExp(`^${name}, \\d`) })
      .click()
  }

  const after = {
    price: Number((await price.innerText()).match(/£(\d+)/)?.[1]),
    carbon: Number((await carbon.innerText()).match(/(\d+)/)?.[1]),
  }
  expect(after.price, "dearer plant has to be called").toBeGreaterThan(
    before.price
  )
  expect(after.carbon, "the gas that left was the dirty part").toBeLessThan(
    before.carbon
  )

  await expect(page.getByRole("alert")).toContainText("Demand not met")
  // Both rows are struck out of the diagram and the table at once.
  await expect(
    diagram(page).getByRole("button", { name: /^Calder A, \d/ })
  ).toHaveAttribute("aria-pressed", "true")
  await toPage(page, "Fleet", info.project.name === "mobile")
  await expect(await rowFor(page, "Calder A")).toContainText("offline")
})

test("returning the units to service clears the shortfall", async ({
  page,
}, info) => {
  await page.goto("/")
  for (const name of ["Calder A", "Calder B"]) {
    await diagram(page)
      .getByRole("button", { name: new RegExp(`^${name}, \\d`) })
      .click()
  }
  await expect(page.getByRole("alert")).toBeVisible()

  await toPage(page, "Fleet", info.project.name === "mobile")
  await page.getByRole("button", { name: /Return 2 units to service/ }).click()

  await toPage(page, "Overview", info.project.name === "mobile")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(
    diagram(page).getByRole("button", { name: /^Calder A, \d/ })
  ).toHaveAttribute("aria-pressed", "false")
})
