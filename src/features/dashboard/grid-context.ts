import { createContext } from "react"

import type { Period, Scenario } from "@/lib/grid/dispatch"
import type { Transient } from "@/lib/grid/frequency"
import type { Unit } from "@/lib/grid/units"

/** The most recent unit taken out while it was generating, and what the frequency did. */
export type TripEvent = {
  readonly unit: Unit
  readonly transient: Transient
  /** `performance.now()` when it happened, so an instrument can replay it from the start. */
  readonly at: number
}

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
  readonly lastTrip: TripEvent | null
}

export const GridContext = createContext<Grid | null>(null)
