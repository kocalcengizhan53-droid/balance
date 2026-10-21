import { describe, expect, it } from "vitest"

import {
  dayStats,
  events,
  pct,
  unitSeries,
  unitStatus,
} from "@/lib/grid/analysis"
import { BASELINE, solve } from "@/lib/grid/dispatch"
import { PERIODS } from "@/lib/grid/profiles"
import { INTERCONNECTOR } from "@/lib/grid/units"

/**
 * The readings the pages are built from. Each one is checked against the solution it
 * summarises, so a card and the table under it cannot drift apart.
 */
describe("dayStats", () => {
  const solution = solve()
  const stats = dayStats(solution)

  it("adds up to the day it summarises", () => {
    const served = solution.periods.reduce(
      (s, p) =>
        s +
        (p.outputs.reduce((a, o) => a + o.mw, 0) +
          Math.max(0, p.interconnector)) *
          0.5,
      0
    )
    expect(stats.energyMWh).toBeCloseTo(served, 6)
    expect(stats.importMWh).toBeCloseTo(
      solution.periods.reduce(
        (s, p) => s + Math.max(0, p.interconnector) * 0.5,
        0
      ),
      6
    )
    expect(stats.periodsShort).toBe(0)
    expect(stats.peakPrice).toBe(
      Math.max(...solution.periods.map((p) => p.price))
    )
  })

  it("costs more under a carbon price and counts the periods a trip leaves short", () => {
    const priced = dayStats(solve([], { ...BASELINE, carbonPrice: 80 }))
    expect(priced.costGBP).toBeGreaterThan(stats.costGBP)
    const tripped = dayStats(solve(["calder-a", "calder-b"]))
    expect(tripped.periodsShort).toBeGreaterThan(0)
    expect(tripped.worstShortMW).toBeGreaterThan(0)
  })
})

describe("unitStatus", () => {
  it("calls a unit constrained when it runs above the clearing price", () => {
    // 04:00: both Calder stations generating at £62 and £64 while the region exports at £41.
    const p = solve().periods[8]
    const calder = p.outputs.find((o) => o.unit.id === "calder-a")!
    expect(calder.mw).toBeGreaterThan(0)
    expect(p.price).toBe(INTERCONNECTOR.exportPrice)
    expect(unitStatus(calder, [], p, 0)).toBe("constrained")
    expect(unitStatus(calder, ["calder-a"], p, 0)).toBe("offline")
  })
})

describe("events and series", () => {
  it("logs every start, stop, price change and shortfall, in period order", () => {
    const log = events(solve(["calder-a", "calder-b"]).periods)
    expect(log.length).toBeGreaterThan(10)
    expect(log.some((e) => e.kind === "short")).toBe(true)
    expect(log.some((e) => e.kind === "price")).toBe(true)
    for (let i = 1; i < log.length; i++)
      expect(log[i].period).toBeGreaterThanOrEqual(log[i - 1].period)
  })

  it("gives a sparkline one value per period", () => {
    expect(unitSeries(solve().periods, "hartmoor")).toHaveLength(PERIODS)
    expect(
      unitSeries(solve().periods, "hartmoor").every((v) => v === 1180)
    ).toBe(true)
  })

  it("has no percentage against nothing", () => {
    expect(pct(10, 0)).toBeNull()
    expect(pct(110, 100)).toBeCloseTo(10)
  })
})
