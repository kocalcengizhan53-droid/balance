import { useCallback, useEffect, useState } from "react"

import { publishGridState } from "@/devtools"
import { solve, type Period } from "@/lib/grid/dispatch"
import { PERIODS } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"

/**
 * One source of state for the whole view.
 *
 * The solved day is derived, never stored: taking a unit offline changes the input and the
 * entire dashboard re-reads. Nothing holds a copy of a number that the solver also produces,
 * which is the only way the tiles, the chart and the schematic can be guaranteed to agree.
 */
export function useGrid() {
  const [offline, setOffline] = useState<readonly string[]>([])
  const [period, setPeriod] = useState(36) // 18:00 — the evening peak, where the day is hardest

  const solution = solve(offline)

  useEffect(() => publishGridState(offline, period), [offline, period])

  const toggle = useCallback((id: string) => {
    setOffline((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }, [])

  const restore = useCallback(() => setOffline([]), [])

  return {
    offline,
    toggle,
    restore,
    period,
    setPeriod: useCallback(
      (p: number) => setPeriod(Math.max(0, Math.min(PERIODS - 1, p))),
      []
    ),
    periods: solution.periods,
    now: solution.periods[period] as Period,
    units: UNITS,
  }
}

export type Grid = ReturnType<typeof useGrid>
