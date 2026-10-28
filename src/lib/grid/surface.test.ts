import { describe, expect, it } from "vitest"

import { BASELINE, solve } from "@/lib/grid/dispatch"
import { priceSurface, SURFACE_LEVELS } from "@/lib/grid/surface"
import { UNITS } from "@/lib/grid/units"

describe("price surface", () => {
  it("has a row per level and a cell per half-hour", () => {
    const rows = priceSurface("windScale", BASELINE, [], UNITS)
    expect(rows).toHaveLength(SURFACE_LEVELS.windScale.length)
    for (const r of rows) expect(r.cells).toHaveLength(48)
  })

  it("puts the scenario's own value on the surface, and it agrees with the page's solve", () => {
    const scenario = { ...BASELINE, windScale: 0.55 }
    const rows = priceSurface("windScale", scenario, ["calder-a"], UNITS)
    const current = rows.filter((r) => r.current)
    expect(current).toHaveLength(1)
    expect(current[0].value).toBe(0.55)
    const page = solve(["calder-a"], scenario, UNITS).periods
    expect(current[0].cells.map((c) => c.price)).toEqual(
      page.map((p) => p.price)
    )
  })

  it("orders the rows from the top of the lever down", () => {
    const values = priceSurface("carbonPrice", BASELINE, [], UNITS).map(
      (r) => r.value
    )
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })

  it("finds the shortfall a calm evening with plant out produces", () => {
    const rows = priceSurface(
      "windScale",
      BASELINE,
      ["hartmoor", "calder-a"],
      UNITS
    )
    const calm = rows.at(-1)!
    expect(calm.value).toBe(0.2)
    expect(calm.cells.some((c) => c.unserved > 0.5)).toBe(true)
  })
})
