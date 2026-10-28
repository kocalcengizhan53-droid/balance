import { solve, type Scenario } from "@/lib/grid/dispatch"
import type { Unit } from "@/lib/grid/units"

export type SurfaceAxis = "windScale" | "carbonPrice" | "demandScale"

/**
 * The rows each lever is sampled at, inside the range its slider allows. The scenario's own
 * value is added when it falls between them, so the row the rest of the page is showing is
 * always on the surface.
 */
export const SURFACE_LEVELS: Record<SurfaceAxis, readonly number[]> = {
  windScale: [0.2, 0.4, 0.6, 0.8, 1, 1.3],
  carbonPrice: [0, 25, 50, 75, 100, 150],
  demandScale: [0.8, 0.9, 1, 1.1, 1.2, 1.25],
}

export type SurfaceCell = {
  readonly price: number
  readonly unserved: number
  readonly marginalUnit: string
}

export type SurfaceRow = {
  readonly value: number
  readonly current: boolean
  readonly cells: readonly SurfaceCell[]
}

/**
 * The price of every half-hour across one lever's range: the whole day re-solved once per row,
 * with everything else — units out, edits, the other two levers — as the page has them.
 *
 * It is the same solver the rest of the page reads, called six or seven times instead of once;
 * a day solves in well under a millisecond, so there is no approximation and no cache to go
 * stale.
 */
export function priceSurface(
  axis: SurfaceAxis,
  scenario: Scenario,
  offline: readonly string[],
  fleet: readonly Unit[]
): SurfaceRow[] {
  const levels = [...new Set([...SURFACE_LEVELS[axis], scenario[axis]])].sort(
    (a, b) => b - a
  )
  return levels.map((value) => ({
    value,
    current: value === scenario[axis],
    cells: solve(offline, { ...scenario, [axis]: value }, fleet).periods.map(
      (p) => ({
        price: p.price,
        unserved: p.unserved,
        marginalUnit: p.marginalUnit,
      })
    ),
  }))
}
