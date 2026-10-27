import { describe, expect, it } from "vitest"

import { solve } from "@/lib/grid/dispatch"
import { applyEdits, validateEdit } from "@/lib/grid/edits"
import { periodLabel } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"

/**
 * An operator's edit is an input to the same solver, never a patch on its output: the balance
 * must still hold in every period, and the change must be visible where the arithmetic says.
 */

const unit = (id: string) => UNITS.find((u) => u.id === id)!

describe("validateEdit", () => {
  const calder = unit("calder-a")

  it("accepts a sensible re-declaration", () => {
    expect(
      validateEdit(calder, { capacity: 800, minStable: 300, marginalCost: 70 })
    ).toEqual({})
  })

  it("refuses capacity outside 1–3000 MW or not a whole number", () => {
    expect(validateEdit(calder, { capacity: 0 }).capacity).toBeDefined()
    expect(validateEdit(calder, { capacity: 3001 }).capacity).toBeDefined()
    expect(validateEdit(calder, { capacity: 812.5 }).capacity).toBeDefined()
  })

  it("refuses a minimum stable output above capacity, including capacity cut below the existing minimum", () => {
    expect(
      validateEdit(calder, { minStable: calder.capacity + 1 }).minStable
    ).toMatch(/exceed capacity/)
    expect(
      validateEdit(calder, { capacity: calder.minStable - 1 }).minStable
    ).toMatch(/exceed capacity/)
  })

  it("refuses a cost below £0 or above £500, and anything that is not a number", () => {
    expect(
      validateEdit(calder, { marginalCost: -1 }).marginalCost
    ).toBeDefined()
    expect(
      validateEdit(calder, { marginalCost: 501 }).marginalCost
    ).toBeDefined()
    expect(
      validateEdit(calder, { marginalCost: Number.NaN }).marginalCost
    ).toBeDefined()
  })
})

describe("applyEdits", () => {
  it("changes only the units edited, and ignores ids that do not exist", () => {
    const fleet = applyEdits(UNITS, {
      "calder-a": { capacity: 700 },
      nowhere: { capacity: 5 },
    })
    expect(fleet.find((u) => u.id === "calder-a")?.capacity).toBe(700)
    expect(fleet.filter((u, i) => u !== UNITS[i]).map((u) => u.id)).toEqual([
      "calder-a",
    ])
    expect(applyEdits(UNITS, {})).toBe(UNITS)
  })
})

describe("solving an edited fleet", () => {
  const edits = {
    "calder-a": { capacity: 600, minStable: 250, marginalCost: 95 },
    hartmoor: { capacity: 900, minStable: 900 },
  }
  const edited = solve([], undefined, applyEdits(UNITS, edits))

  it("still balances generation against demand in every period", () => {
    for (const p of edited.periods) {
      const lhs =
        p.outputs.reduce((sum, o) => sum + o.mw, 0) +
        Math.max(0, p.interconnector) +
        p.unserved
      const rhs = p.demand + Math.max(0, -p.interconnector)
      expect(
        Math.abs(lhs - rhs),
        `${periodLabel(p.period)}: ${lhs} in, ${rhs} out`
      ).toBeLessThan(0.1)
    }
  })

  it("never runs a unit above its edited capacity, and carries the edited unit in every output", () => {
    for (const p of edited.periods) {
      const calder = p.outputs.find((o) => o.unit.id === "calder-a")!
      expect(calder.mw).toBeLessThanOrEqual(600 + 0.001)
      expect(calder.unit.marginalCost).toBe(95)
    }
    expect(edited.fleet.find((u) => u.id === "hartmoor")?.capacity).toBe(900)
  })

  it("moves the day: less nuclear means more from somewhere else at 04:00", () => {
    const base = solve()
    const at = (s: typeof base, id: string) =>
      s.periods[8].outputs.find((o) => o.unit.id === id)!.mw
    expect(at(edited, "hartmoor")).toBeLessThan(at(base, "hartmoor"))
    expect(edited.periods[8]).not.toEqual(base.periods[8])
  })
})
