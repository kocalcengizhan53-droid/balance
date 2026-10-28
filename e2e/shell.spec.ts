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

/** The shell: the rail, the palette, and the product patterns on each page. */

test("the rail reaches every page and the header names it", async ({
  page,
}, info) => {
  await page.goto("/")
  for (const [name, heading] of [
    ["Fleet", "Fleet"],
    ["Market", "Market"],
    ["Scenarios", "Scenarios"],
    ["Overview", "Overview"],
  ]) {
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: /toggle sidebar/i }).click()
    await page.getByRole("link", { name, exact: true }).first().click()
    await expect(
      page.getByRole("heading", { level: 1, name: heading })
    ).toBeVisible()
  }
})

test("⌘K opens the palette, and a command runs", async ({ page }, info) => {
  test.skip(
    info.project.name === "mobile",
    "the palette's shortcut is a keyboard affordance"
  )
  await page.goto("/")
  await page.keyboard.press("ControlOrMeta+k")
  const input = page.getByPlaceholder(/Go to, play/)
  await expect(input).toBeVisible()
  await input.fill("market")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { level: 1, name: "Market" })
  ).toBeVisible()
  await page.keyboard.press("ControlOrMeta+k")
  await page.getByPlaceholder(/Go to, play/).fill("hartmoor")
  await page.keyboard.press("Enter")
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline))
    .toEqual(["hartmoor"])
})

test("the fleet table filters, sorts, hides columns, selects, and opens a drawer", async ({
  page,
}) => {
  await page.goto("/fleet")
  await page.getByRole("button", { name: "Table", exact: true }).click()
  await expect(page.getByRole("row")).toHaveCount(9) // header + 8 on the first page
  await page.getByRole("button", { name: "Next page" }).click()
  await expect(page.getByRole("row")).toHaveCount(4)
  await page.getByRole("button", { name: "Previous page" }).click()

  await page.getByRole("tab", { name: /^idle/i }).click()
  await expect(page.getByRole("row", { name: /\bFenley/ })).toBeVisible()
  await expect(await rowFor(page, "Hartmoor")).toHaveCount(0)
  await page.getByRole("tab", { name: /^all/i }).click()

  await page.getByLabel("Find a unit").fill("cald")
  await expect(page.getByRole("row")).toHaveCount(3)
  await page.getByLabel("Find a unit").fill("")

  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Node" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("columnheader", { name: /Node/ })).toHaveCount(0)

  await page.getByRole("checkbox", { name: "Select Calder A" }).click()
  await page.getByRole("checkbox", { name: "Select Calder B" }).click()
  await page.getByRole("button", { name: "Take offline" }).click()
  await expect(await rowFor(page, "Calder A")).toContainText("offline")
  await expect(page.getByRole("alert")).toHaveCount(0) // the alert lives on the overview
  await expect(
    page.getByRole("button", { name: /Return 2 units to service/ })
  ).toBeVisible()

  await (await rowFor(page, "Hartmoor")).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toContainText("Hartmoor")
  await expect(sheet).toContainText("Minimum stable")
  await sheet.getByRole("switch", { name: /Hartmoor in service/ }).click()
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.offline.length))
    .toBe(3)
})

test("the market page pages the settlement run and moves the clock from a row", async ({
  page,
}) => {
  await page.goto("/market")
  await expect(page.getByText("18:00 – 23:30")).toBeVisible()
  await page.getByRole("button", { name: "Previous page" }).click()
  await expect(page.getByText("12:00 – 17:30")).toBeVisible()
  await page.getByRole("row", { name: /\b12:00/ }).click()
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.period))
    .toBe(24)
})

test("a scenario preset pulls the levers and the comparison moves", async ({
  page,
}) => {
  await page.goto("/scenarios")
  const short = page.locator('[data-figure^="Periods short"]')
  await expect(short).toContainText("0")
  await page.getByRole("button", { name: /^Bad evening/ }).click()
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.scenario.windScale))
    .toBe(0.4)
  await expect(
    page.getByRole("button", { name: /^Bad evening/ })
  ).toHaveAttribute("aria-pressed", "true")
})
