import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/**
 * Whether the page can be read, measured rather than looked at.
 *
 * Both of these exist because a check that did not make them failed to notice a page that was
 * visibly broken. The dispatch chart set its axis labels in viewBox units, so an 11px label in
 * a phone column painted at four pixels — type that passes every unit test and cannot be read
 * by anybody. And the schematic's rows are drawn inside a horizontal scroller, which is fine,
 * while the document itself scrolling sideways is not.
 */

/** The smallest painted size of any text inside an SVG, per figure, in real CSS pixels. */
async function smallestSvgText(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, number> = {}
    for (const svg of document.querySelectorAll("svg")) {
      const name =
        svg.closest("figure")?.querySelector("h2")?.textContent?.trim() ?? "?"
      const scale =
        svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
      const sizes = [...svg.querySelectorAll("text")].map(
        (t) => parseFloat(getComputedStyle(t).fontSize) * scale
      )
      if (sizes.length) out[name] = Math.round(Math.min(...sizes) * 10) / 10
    }
    return out
  })
}

for (const width of [390, 768, 1280, 1600]) {
  test(`at ${width}px nothing overflows and no label paints under 9px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "Dispatch", exact: true })
    ).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
    expect(overflow, "the document itself scrolling sideways").toBe(0)

    const sizes = await smallestSvgText(page)
    expect(Object.keys(sizes).length, "figures found").toBeGreaterThanOrEqual(3)
    for (const [name, px] of Object.entries(sizes)) {
      expect(px, `smallest text in "${name}"`).toBeGreaterThanOrEqual(9)
    }

    await page.screenshot({
      path: `qa-output/layout-${width}.png`,
      fullPage: true,
    })
  })
}

test("every figure is drawn, and drawn again in dark mode", async ({
  page,
}) => {
  await page.goto("/")

  // The dispatch stack is one filled area per fuel; an empty chart is a page of captions.
  const areas = page.locator("figure", {
    has: page.getByText("Dispatch across the day"),
  })
  await expect(areas.locator("svg > path[fill^='var(--fuel']")).toHaveCount(8)
  await expect(
    page
      .locator("figure", { has: page.getByText("Merit order") })
      .locator("svg rect")
  ).not.toHaveCount(0)

  await page.getByRole("button", { name: /Switch to dark theme/ }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(areas.locator("svg > path[fill^='var(--fuel']")).toHaveCount(8)
  await page.screenshot({ path: "qa-output/dark.png", fullPage: true })
})
