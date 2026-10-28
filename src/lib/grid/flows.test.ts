import { describe, expect, it } from "vitest"

import { BASELINE, solve } from "@/lib/grid/dispatch"
import { energyFlows, NODE_ORDER } from "@/lib/grid/flows"
import { FUEL_ORDER } from "@/lib/viz/fuel"

describe("energy flows", () => {
  const day = solve([], BASELINE).periods
  // A windy, quiet day: long enough on wind to send power across the strait.
  const long = solve([], {
    ...BASELINE,
    windScale: 1.3,
    demandScale: 0.8,
  }).periods

  it("loses nothing between the plants, the nodes and the sinks", () => {
    for (const p of [...day, ...long]) {
      const f = energyFlows(p)
      const into = f.inflows.reduce((s, x) => s + x.mw, 0)
      const out = f.outflows.reduce((s, x) => s + x.mw, 0)
      expect(into).toBeCloseTo(f.total, 6)
      expect(out).toBeCloseTo(f.total, 6)
      for (const node of NODE_ORDER) {
        const leaving = f.outflows
          .filter((x) => x.node === node)
          .reduce((s, x) => s + x.mw, 0)
        expect(leaving).toBeCloseTo(f.nodes[node], 6)
      }
    }
  })

  it("delivers to demand exactly what the solver says was served", () => {
    for (const p of [...day, ...long]) {
      const f = energyFlows(p)
      expect(f.sinks.demand).toBeCloseTo(p.demand - p.unserved, 1)
      expect(f.sinks.export).toBeCloseTo(Math.max(0, -p.interconnector), 6)
    }
  })

  it("keeps the same shape every half-hour, so the diagram can tween", () => {
    const sizes = day.map((p) => {
      const f = energyFlows(p)
      return `${f.inflows.length}/${f.outflows.length}`
    })
    expect(new Set(sizes).size).toBe(1)
    expect(energyFlows(day[0]).inflows.length).toBe(
      FUEL_ORDER.length * NODE_ORDER.length
    )
  })

  it("brings imports in at the strait's node and nowhere else", () => {
    const p = day.find((x) => x.interconnector > 1)!
    const f = energyFlows(p)
    const imports = f.inflows.filter((x) => x.fuel === "import" && x.mw > 0)
    expect(imports.map((x) => x.node)).toEqual(["east"])
  })

  it("shows the export when the region is long", () => {
    expect(long.some((p) => energyFlows(p).sinks.export > 1)).toBe(true)
  })
})
