import type { Period } from "@/lib/grid/dispatch"
import { FUEL_ORDER, type Series } from "@/lib/viz/fuel"

/** Fuels that emit nothing at the point of generation. Storage only moves energy in time. */
const LOW_CARBON = new Set<Series>(["nuclear", "wind", "solar", "hydro"])

/**
 * What is serving the region this half-hour, by fuel, in the stacking order the palette was
 * validated in — imports included as a fuel of their own, exports left out, since exported
 * power is not serving anyone here.
 */
export function generationMix(p: Period) {
  const byFuel = new Map<Series, number>(FUEL_ORDER.map((f) => [f, 0]))
  for (const o of p.outputs)
    byFuel.set(
      o.unit.fuel as Series,
      (byFuel.get(o.unit.fuel as Series) ?? 0) + o.mw
    )
  byFuel.set("import", Math.max(0, p.interconnector))
  const slices = FUEL_ORDER.map((fuel) => ({
    fuel,
    mw: byFuel.get(fuel) ?? 0,
  })).filter((s) => s.mw > 0.5)
  const total = slices.reduce((s, x) => s + x.mw, 0)
  const lowCarbon = slices
    .filter((s) => LOW_CARBON.has(s.fuel))
    .reduce((s, x) => s + x.mw, 0)
  return {
    slices: slices.map((s) => ({ ...s, share: total ? s.mw / total : 0 })),
    total,
    lowCarbonShare: total ? lowCarbon / total : 0,
  }
}
