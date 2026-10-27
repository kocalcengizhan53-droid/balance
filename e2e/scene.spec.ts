import { expect, test } from "./fixtures"

/**
 * The stage: a picture of the region paints before any JavaScript, and the live model replaces
 * it — by itself on a desktop, when asked on a phone. If WebGL is missing the picture stays and
 * nothing on the page breaks.
 */

test("the region is on screen at once, as a picture of the scene", async ({
  page,
}) => {
  await page.goto("/")
  const poster = page.locator("[data-scene] > img")
  await expect(poster).toBeVisible()
  const loaded = await poster.evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
  )
  expect(loaded, "the poster image decoded").toBe(true)
})

test("on a desktop the live scene takes over from the picture", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "a phone waits to be asked")
  test.skip(
    !!process.env.CI,
    "the CI runner has no GPU, so the live scene never starts"
  )
  await page.goto("/")
  await expect(page.locator('[data-scene="live"]')).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.locator("[data-scene] canvas")).toBeVisible()
  const labels = page
    .getByRole("group", { name: "Plants in the region" })
    .getByRole("button")
  await expect(labels).toHaveCount(11)
})

test("on a phone the picture stays until the visitor asks for the model", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "phones only")
  await page.goto("/")
  await expect(page.locator('[data-scene="poster"]')).toBeVisible()
  await page.waitForTimeout(1500)
  // Nothing has loaded three.js on its own.
  const loadedScene = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .some((r) => /RegionScene/.test(r.name))
  )
  expect(loadedScene).toBe(false)
  await expect(
    page.getByRole("button", { name: "Explore in 3D" })
  ).toBeVisible()
})
