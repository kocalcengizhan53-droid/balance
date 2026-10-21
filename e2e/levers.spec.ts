import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/** The clock and the levers: the two things that make the page move without a trip. */

const figure = async (page: Page, name: string) =>
  Number(
    (await page.locator(`[data-figure^="${name}"]`).innerText())
      .match(/\d[\d,]*/)?.[0]
      ?.replace(/,/g, "")
  )

test("Play runs the clock, and the instruments follow it", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Play the day/ }).click()
  await expect(
    page.getByRole("button", { name: /Pause the day/ })
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.period), {
      timeout: 5000,
    })
    .not.toBe(36)
  // The slider that scrubs the day is the same clock.
  const slider = page.getByRole("slider", { name: /Time/ })
  const a = Number(await slider.inputValue())
  await page.waitForTimeout(1600)
  expect(Number(await slider.inputValue()), "the clock keeps moving").not.toBe(
    a
  )
  await page.getByRole("button", { name: /Pause the day/ }).click()
  await expect(page.getByRole("button", { name: /Play the day/ })).toBeVisible()
})

test("a carbon price makes the system dearer and no dirtier", async ({
  page,
}) => {
  await page.goto("/")
  const before = {
    price: await figure(page, "Price"),
    carbon: await figure(page, "Carbon intensity"),
  }
  await page.getByRole("slider", { name: /Carbon price/ }).fill("120")
  await expect
    .poll(() => page.evaluate(() => window.__app?.state.scenario.carbonPrice))
    .toBe(120)
  await expect
    .poll(() => figure(page, "Price"), { timeout: 3000 })
    .toBeGreaterThan(before.price)
  expect(await figure(page, "Carbon intensity")).toBeLessThanOrEqual(
    before.carbon
  )
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible()
})

test("a still day pulls more through the link", async ({ page }) => {
  await page.goto("/")
  const before = await figure(page, "Interconnector")
  await page.getByRole("slider", { name: /^Wind/ }).fill("0.2")
  await expect
    .poll(() => figure(page, "Interconnector"), { timeout: 3000 })
    .toBeGreaterThanOrEqual(before)
  await expect(page.locator('[data-figure^="Interconnector"]')).toContainText(
    "importing"
  )
})
