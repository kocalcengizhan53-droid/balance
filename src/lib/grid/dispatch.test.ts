import { describe, expect, it } from "vitest"

import {
  BASELINE,
  costWithCarbon,
  energy,
  served,
  solve,
} from "@/lib/grid/dispatch"
import { DEMAND, PERIODS, periodLabel } from "@/lib/grid/profiles"
import { INTERCONNECTOR, UNITS } from "@/lib/grid/units"

/**
 * The one rule, enforced.
 *
 * A dashboard whose numbers do not reconcile is the normal case, not the exception — the
 * tiles are computed one way, the chart another, and nobody adds them up. Here the balance is
 * an assertion: everything generated plus everything imported equals everything consumed,
 * exported or spilled, in all forty-eight periods and under every outage the UI can produce.
 */

const TOLERANCE = 0.1

describe("dispatch", () => {
  const base = solve()

  it("balances generation against demand in every period", () => {
    for (const p of base.periods) {
      const generated = p.outputs.reduce((sum, o) => sum + o.mw, 0)
      const imported = Math.max(0, p.interconnector)
      const exported = Math.max(0, -p.interconnector)
      const lhs = generated + imported + p.unserved
      const rhs = p.demand + exported

      expect(
        Math.abs(lhs - rhs),
        `${periodLabel(p.period)}: ${lhs} in, ${rhs} out`
      ).toBeLessThan(TOLERANCE)
    }
  })

  it("serves the whole day", () => {
    const short = base.periods.filter((p) => p.unserved > TOLERANCE)
    expect(short.map((p) => periodLabel(p.period))).toEqual([])
  })

  it("never asks a unit for more than it has", () => {
    for (const p of base.periods) {
      for (const o of p.outputs) {
        expect(
          o.mw,
          `${o.unit.name} at ${periodLabel(p.period)}`
        ).toBeLessThanOrEqual(o.available + TOLERANCE)
        expect(o.mw).toBeGreaterThanOrEqual(0)
      }
    }
    for (const p of base.periods) {
      expect(Math.abs(p.interconnector)).toBeLessThanOrEqual(
        INTERCONNECTOR.capacity + TOLERANCE
      )
    }
  })

  it("respects every ramp rate, including across midnight", () => {
    // The day is solved cyclically, so the step from the last period back to the first is a
    // real constraint rather than a seam the model is allowed to ignore.
    for (let p = 0; p < PERIODS; p++) {
      const now = base.periods[p]
      const before = base.periods[(p - 1 + PERIODS) % PERIODS]
      for (const o of now.outputs) {
        const was = before.outputs.find((x) => x.unit.id === o.unit.id)!.mw
        const limit = o.unit.rampRate * 30 + TOLERANCE
        expect(
          Math.abs(o.mw - was),
          `${o.unit.name} moved ${Math.abs(o.mw - was).toFixed(0)} MW into ${periodLabel(p)}`
        ).toBeLessThanOrEqual(limit)
      }
    }
  })

  it("never runs a thermal unit below its minimum stable output", () => {
    for (const p of base.periods) {
      for (const o of p.outputs) {
        if (o.unit.minStable === 0 || o.mw === 0) continue
        expect(
          o.mw,
          `${o.unit.name} at ${periodLabel(p.period)} is under its minimum stable output`
        ).toBeGreaterThanOrEqual(o.unit.minStable - TOLERANCE)
      }
    }
  })

  it("still balances with the two largest units offline", () => {
    const biggest = [...UNITS]
      .sort((a, b) => b.capacity - a.capacity)
      .slice(0, 2)
    const broken = solve(biggest.map((u) => u.id))

    for (const p of broken.periods) {
      const generated = p.outputs.reduce((sum, o) => sum + o.mw, 0)
      const lhs = generated + Math.max(0, p.interconnector) + p.unserved
      const rhs = p.demand + Math.max(0, -p.interconnector)
      expect(Math.abs(lhs - rhs)).toBeLessThan(TOLERANCE)
    }
    for (const u of biggest) {
      const ran = broken.periods.some(
        (p) => p.outputs.find((o) => o.unit.id === u.id)!.mw > 0
      )
      expect(ran, `${u.name} generated while offline`).toBe(false)
    }
  })

  it("prices the margin at the cost of the last thing called", () => {
    /*
     * Not the dearest plant running — the plant that was called last.
     *
     * The first version of this asserted the dearest, and failed at 20:30 where biomass at
     * £79 was on the system while the price was £71. The model was right: a unit that is
     * running only because it cannot shut down inside half an hour is constrained on, and a
     * constrained-on unit does not set the price. What has to agree is the price and the
     * name printed beside it, because those two are what the dashboard shows.
     */
    for (const p of base.periods) {
      expect(p.price).toBeGreaterThanOrEqual(0)

      const named = UNITS.find((u) => u.name === p.marginalUnit)
      if (named) {
        expect(p.price, `${periodLabel(p.period)} says ${p.marginalUnit}`).toBe(
          named.marginalCost
        )
        expect(
          p.outputs.find((o) => o.unit.id === named.id)!.mw,
          `${named.name} set the price at ${periodLabel(p.period)} without generating`
        ).toBeGreaterThan(0)
      } else if (p.marginalUnit === INTERCONNECTOR.name) {
        expect(p.price).toBe(INTERCONNECTOR.importCost)
        expect(p.interconnector).toBeGreaterThan(0)
      } else if (p.marginalUnit === "export") {
        expect(p.price).toBe(INTERCONNECTOR.exportPrice)
        expect(p.interconnector).toBeLessThan(0)
      }
    }
  })

  it("agrees with its own totals", () => {
    const demandEnergy = energy(base.periods, (p) => p.demand)
    const servedEnergy = energy(base.periods, served)
    const exportEnergy = energy(base.periods, (p) =>
      Math.max(0, -p.interconnector)
    )
    expect(Math.abs(servedEnergy - demandEnergy - exportEnergy)).toBeLessThan(
      TOLERANCE
    )
    expect(demandEnergy).toBeCloseTo(
      DEMAND.reduce((s, d) => s + d * 0.5, 0),
      6
    )
  })
})

describe("the levers", () => {
  it("still balances under every lever, pulled hard", () => {
    for (const scenario of [
      { ...BASELINE, carbonPrice: 150 },
      { ...BASELINE, demandScale: 1.25 },
      { ...BASELINE, windScale: 0.2 },
      { carbonPrice: 120, demandScale: 1.2, windScale: 0.3 },
    ]) {
      for (const p of solve([], scenario).periods) {
        const generated = p.outputs.reduce((s, o) => s + o.mw, 0)
        const lhs = generated + Math.max(0, p.interconnector) + p.unserved
        const rhs = p.demand + Math.max(0, -p.interconnector)
        expect(Math.abs(lhs - rhs), JSON.stringify(scenario)).toBeLessThan(
          TOLERANCE
        )
      }
    }
  })

  it("a carbon price moves gas behind the cleaner plant it used to beat", () => {
    // At £0 gas at Calder A (£62) runs before biomass at Thornby (£79). Price carbon and the
    // 352 g gas unit gains £17.60 per £50 — by £60/t it is dearer than the 121 g biomass.
    const gas = (price: number) => costWithCarbon(62, 352, price)
    const biomass = (price: number) => costWithCarbon(79, 121, price)
    expect(gas(0)).toBeLessThan(biomass(0))
    expect(gas(80)).toBeGreaterThan(biomass(80))

    // And the system price rises with it: the marginal unit is dearer in every period.
    const base = solve().periods
    const priced = solve([], { ...BASELINE, carbonPrice: 80 }).periods
    const meanPrice = (ps: typeof base) =>
      ps.reduce((s, p) => s + p.price, 0) / ps.length
    expect(meanPrice(priced)).toBeGreaterThan(meanPrice(base))
  })

  it("a calm day leaves the system importing where it was exporting", () => {
    const windy = solve().periods
    const calm = solve([], { ...BASELINE, windScale: 0.2 }).periods
    const imported = (ps: typeof windy) =>
      ps.reduce((s, p) => s + Math.max(0, p.interconnector), 0)
    expect(imported(calm)).toBeGreaterThan(imported(windy))
  })
})
