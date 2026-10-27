import type { Page } from "@playwright/test"
import { readFileSync } from "node:fs"

import { expect, test } from "./fixtures"

/**
 * The control room as a product: a visitor signs in with a role, an operator re-declares a unit
 * and the day re-solves, a viewer reads and exports, and the server's audit log records both.
 */

async function signIn(
  page: Page,
  name: string,
  role: "Viewer" | "Operator",
  mobile: boolean
) {
  if (mobile)
    await page.getByRole("button", { name: /toggle sidebar/i }).click()
  await page.getByRole("button", { name: "Sign in" }).first().click()
  const dialog = page.getByRole("dialog", {
    name: "Sign in to the control room",
  })
  await dialog.getByLabel("Your name").fill(name)
  await dialog.getByLabel(new RegExp(role)).check()
  await dialog.getByRole("button", { name: "Sign in" }).click()
  await expect(dialog).toBeHidden()
  if (mobile) await page.keyboard.press("Escape")
}

const calder = (page: Page) =>
  page.getByRole("row", { name: /Calder A/ }).first()

test("an operator re-declares a unit; the fleet and the audit log follow", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile"
  await page.goto("/fleet")
  await signIn(page, "Deniz A.", "Operator", mobile)

  await calder(page).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel(/Capacity/).fill("600")
  await sheet.getByRole("button", { name: "Save and re-solve" }).click()
  await expect(sheet.getByRole("status")).toHaveText(/re-solved/)
  await expect(sheet).toContainText("600 MW")

  // The browser refuses what the server would, against the figures now in force.
  await sheet.getByLabel(/Minimum stable/).fill("700")
  await sheet.getByRole("button", { name: "Save and re-solve" }).click()
  await expect(
    sheet.getByText(/cannot exceed capacity \(600 MW\)/)
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await page.goto("/audit")
  await expect(
    page.getByRole("cell", { name: "Calder A: capacity 910 MW → 600 MW" })
  ).toBeVisible()
  await expect(page.getByRole("cell", { name: "as operator" })).toBeVisible()
})

test("a viewer reads and exports, cannot edit, and the download is logged", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile"
  await page.goto("/fleet")
  await signIn(page, "Jun P.", "Viewer", mobile)

  await calder(page).click()
  await expect(
    page.getByRole("dialog").getByText(/Viewers read and export/)
  ).toBeVisible()
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save and re-solve" })
  ).toHaveCount(0)
  await page.keyboard.press("Escape")

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ])
  const csv = readFileSync((await download.path())!, "utf8").replace(/^\uFEFF/, "")
  const rows = csv.trim().split("\r\n")
  expect(rows[0]).toBe(
    "Unit,Fuel,Status,Output MW,Available MW,Capacity MW,Minimum stable MW,Marginal cost £/MWh,Carbon gCO2/kWh,Node"
  )
  expect(rows).toHaveLength(12) // the header and eleven units

  await page.goto("/audit")
  await expect(
    page.getByRole("cell", { name: "the fleet as CSV" })
  ).toBeVisible()
})

test("a visitor who never signs in costs the API nothing", async ({ page }) => {
  const calls: string[] = []
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(r.url())
  })
  for (const path of ["/", "/fleet", "/market", "/audit"]) await page.goto(path)
  await expect(
    page.getByRole("heading", { name: "The audit log belongs to a sandbox" })
  ).toBeVisible()
  expect(calls).toEqual([])
})
