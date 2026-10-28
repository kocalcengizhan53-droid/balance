import { describe, expect, it } from "vitest"

import { BASELINE, solve } from "@/lib/grid/dispatch"
import { generationMix } from "@/lib/grid/mix"
import { FUEL_ORDER } from "@/lib/viz/fuel"

describe("generation mix", () => {
  const day = solve([], BASELINE).periods

  it("adds up to everything generated here plus whatever is imported", () => {
    for (const p of day) {
      const mix = generationMix(p)
      const generated =
        p.outputs.reduce((s, o) => s + o.mw, 0) + Math.max(0, p.interconnector)
      expect(mix.total).toBeCloseTo(generated, 3)
      expect(mix.slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6)
    }
  })

  it("keeps the palette's stacking order, so neighbours stay distinguishable", () => {
    const order = generationMix(day[24]).slices.map((s) =>
      FUEL_ORDER.indexOf(s.fuel)
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("counts more of the mix as low-carbon at a sunny noon than at the evening peak", () => {
    expect(generationMix(day[25]).lowCarbonShare).toBeGreaterThan(
      generationMix(day[36]).lowCarbonShare
    )
  })
})
