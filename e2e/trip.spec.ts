import { expect, test } from "./fixtures"

/** The single-line diagram: the one place a unit's control stands still. */
const diagram = (page: import("@playwright/test").Page) =>
  page.locator("figure", { has: page.getByText("Where it is coming from") })

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
}) => {
  await page.goto("/")

  const price = page.locator('[data-figure="Price"]')
  const carbon = page.locator('[data-figure^="Carbon intensity"]')
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
  await expect(page.getByRole("row", { name: /^Calder A\b/ })).toContainText(
    "offline"
  )
})

test("returning the units to service clears the shortfall", async ({
  page,
}) => {
  await page.goto("/")
  for (const name of ["Calder A", "Calder B"]) {
    await diagram(page)
      .getByRole("button", { name: new RegExp(`^${name}, \\d`) })
      .click()
  }
  await expect(page.getByRole("alert")).toBeVisible()

  await page.getByRole("button", { name: /Return 2 units to service/ }).click()

  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(
    diagram(page).getByRole("button", { name: /^Calder A, \d/ })
  ).toHaveAttribute("aria-pressed", "false")
})
