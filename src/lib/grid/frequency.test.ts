import { describe, expect, it } from "vitest"

import { BASELINE, solve } from "@/lib/grid/dispatch"
import {
  NOMINAL,
  ambient,
  frequencyAt,
  systemInertia,
  trip,
} from "@/lib/grid/frequency"

const evening = (wind = BASELINE.windScale) =>
  solve([], { ...BASELINE, windScale: wind }).periods[36]

describe("frequency after a trip", () => {
  it("does nothing when the unit was not generating", () => {
    const p = evening()
    const idle = p.outputs.find((o) => o.mw < 0.5)
    if (idle) expect(trip(p, idle.unit.id)).toBeNull()
    expect(trip(p, "no-such-unit")).toBeNull()
  })

  it("falls at the rate the swing equation gives, then is arrested and recovers", () => {
    const p = evening()
    const t = trip(p, "hartmoor")!
    expect(t.lost).toBeCloseTo(
      p.outputs.find((o) => o.unit.id === "hartmoor")!.mw,
      6
    )
    expect(t.rocof).toBeCloseTo(-(t.lost * NOMINAL) / (2 * t.inertia), 9)
    // The first tenth of a second follows the initial slope before any reserve has answered.
    expect(frequencyAt(t, 0.1) - NOMINAL).toBeCloseTo(t.rocof * 0.1, 2)
    expect(t.nadir).toBeLessThan(NOMINAL)
    expect(t.nadirAt).toBeGreaterThan(0.2)
    expect(t.settled).toBeGreaterThan(t.nadir)
  })

  it("falls further for a bigger loss", () => {
    const p = evening()
    const running = p.outputs
      .filter((o) => o.mw > 50)
      .sort((a, b) => a.mw - b.mw)
    const small = trip(p, running[0].unit.id)
    const big = trip(p, running[running.length - 1].unit.id)
    if (small && big) expect(big.nadir).toBeLessThan(small.nadir)
  })

  it("falls faster on a windy half-hour: wind spins nothing", () => {
    const calm = evening(0.2)
    const windy = evening(1.3)
    expect(systemInertia(windy).energy).toBeLessThanOrEqual(
      systemInertia(calm).energy
    )
    const a = trip(calm, "hartmoor")!
    const b = trip(windy, "hartmoor")!
    expect(Math.abs(b.rocof)).toBeGreaterThanOrEqual(Math.abs(a.rocof))
  })

  it("switches off demand in 5% blocks rather than let it fall past 48.8 Hz for long", () => {
    const p = evening()
    const t = trip(p, "hartmoor")!
    expect(t.blocks).toBeGreaterThan(0)
    expect(t.shed).toBeCloseTo(t.blocks * 0.05 * p.demand, 6)
    expect(t.nadir).toBeGreaterThan(48)
    const small = p.outputs
      .filter((o) => o.mw > 50)
      .sort((a, b) => a.mw - b.mw)[0]
    expect(trip(p, small.unit.id)!.blocks).toBe(0)
  })

  it("wanders only by tens of millihertz when nothing happens", () => {
    for (let s = 0; s < 60; s += 0.37)
      expect(Math.abs(ambient(s) - NOMINAL)).toBeLessThan(0.02)
  })
})
