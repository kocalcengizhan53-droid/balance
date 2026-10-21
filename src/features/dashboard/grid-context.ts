import { createContext } from "react"

import type { Period, Scenario } from "@/lib/grid/dispatch"
import type { Unit } from "@/lib/grid/units"

/**
 * Everything the page knows, in one object.
 *
 * Inputs — which units are out, which half-hour is showing, which levers are pulled — and the
 * solution derived from them. Nothing here is a copy of a number the solver also produces,
 * which is the only way the masthead, the scene, the tiles and the table can be guaranteed
 * to agree.
 */
export type Grid = {
  readonly offline: readonly string[]
  readonly toggle: (id: string) => void
  readonly restore: () => void

  readonly period: number
  readonly setPeriod: (period: number) => void
  /** The clock is running: the period advances every few hundred milliseconds and wraps. */
  readonly playing: boolean
  readonly setPlaying: (playing: boolean) => void

  readonly scenario: Scenario
  readonly setScenario: (patch: Partial<Scenario>) => void
  readonly resetScenario: () => void

  readonly periods: readonly Period[]
  readonly now: Period
  readonly units: readonly Unit[]
}

export const GridContext = createContext<Grid | null>(null)
