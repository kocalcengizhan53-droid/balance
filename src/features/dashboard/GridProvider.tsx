import { useCallback, useEffect, useState, type ReactNode } from "react"

import { publishGridState } from "@/devtools"
import { GridContext, type Grid } from "@/features/dashboard/grid-context"
import {
  BASELINE,
  solve,
  type Period,
  type Scenario,
} from "@/lib/grid/dispatch"
import { PERIODS } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"

/** How long the clock sits on each half-hour while it is running. */
const TICK_MS = 720

/**
 * One source of state for the whole view.
 *
 * The solved day is derived, never stored: taking a unit offline or pulling a lever changes
 * an input and the entire dashboard re-reads. The clock is the one piece of state that
 * changes on its own — when it runs, the period advances and wraps at midnight, and every
 * instrument follows it because every instrument reads `now`.
 */
export function GridProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState<readonly string[]>([])
  const [period, setPeriodState] = useState(36) // 18:00 — the evening peak, where the day is hardest
  const [playing, setPlaying] = useState(false)
  const [scenario, setScenarioState] = useState<Scenario>(BASELINE)

  const solution = solve(offline, scenario)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(
      () => setPeriodState((p) => (p + 1) % PERIODS),
      TICK_MS
    )
    return () => window.clearInterval(id)
  }, [playing])

  useEffect(
    () => publishGridState(offline, period, scenario),
    [offline, period, scenario]
  )

  const toggle = useCallback((id: string) => {
    setOffline((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }, [])

  const grid: Grid = {
    offline,
    toggle,
    restore: useCallback(() => setOffline([]), []),
    period,
    setPeriod: useCallback(
      (p: number) => setPeriodState(Math.max(0, Math.min(PERIODS - 1, p))),
      []
    ),
    playing,
    setPlaying,
    scenario,
    setScenario: useCallback(
      (patch: Partial<Scenario>) =>
        setScenarioState((current) => ({ ...current, ...patch })),
      []
    ),
    resetScenario: useCallback(() => setScenarioState(BASELINE), []),
    periods: solution.periods,
    now: solution.periods[period] as Period,
    units: UNITS,
  }

  return <GridContext.Provider value={grid}>{children}</GridContext.Provider>
}
