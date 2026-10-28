import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { TICK_MS } from "@/features/dashboard/clock"
import { readUrlState, writeUrlState } from "@/features/dashboard/url-state"

import { publishGridState } from "@/devtools"
import {
  GridContext,
  type Grid,
  type TripEvent,
} from "@/features/dashboard/grid-context"
import {
  BASELINE,
  solve,
  type Period,
  type Scenario,
} from "@/lib/grid/dispatch"
import { applyEdits } from "@/lib/grid/edits"
import { trip } from "@/lib/grid/frequency"
import { PERIODS } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"
import { useSession } from "@/features/session/useSession"

/*
 * A dashboard that sits still until it is touched looks like a picture of one. So the day plays
 * by itself once the page is idle — unless the link names a half-hour (somebody sent that view
 * on purpose), motion is reduced, or a test is driving the page — and stops at the first click
 * or key, because by then the visitor is reading. Scrolling does not stop it. `?play=1` starts
 * the clock in any case, so a playing view can be sent too.
 */
function useAutoplay(named: boolean, setPlaying: (on: boolean) => void) {
  useEffect(() => {
    const asked = new URLSearchParams(location.search).get("play") === "1"
    if (asked) return void setPlaying(true)
    if (
      named ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      navigator.webdriver
    )
      return
    let started = false
    const idle = typeof requestIdleCallback === "function"
    const start = () => {
      started = true
      setPlaying(true)
    }
    const id = idle
      ? requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 1500)
    const stop = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        ["Tab", "Shift"].includes(event.key)
      )
        return
      if (started) setPlaying(false)
      cleanup()
    }
    const cleanup = () => {
      if (idle) cancelIdleCallback(id as number)
      else window.clearTimeout(id)
      removeEventListener("click", stop, true)
      removeEventListener("keydown", stop, true)
    }
    addEventListener("click", stop, true)
    addEventListener("keydown", stop, true)
    return cleanup
  }, [named, setPlaying])
}

/**
 * One source of state for the whole view.
 *
 * The solved day is derived, never stored: taking a unit offline or pulling a lever changes
 * an input and the entire dashboard re-reads. The clock is the one piece of state that
 * changes on its own — when it runs, the period advances and wraps at midnight, and every
 * instrument follows it because every instrument reads `now`.
 */
export function GridProvider({ children }: { children: ReactNode }) {
  // 18:00 by default — the evening peak, where the day is hardest — unless the URL says otherwise.
  const [initial] = useState(() => readUrlState())
  const [offline, setOffline] = useState<readonly string[]>(initial.offline)
  const [period, setPeriodState] = useState(initial.period ?? 36)
  const [playing, setPlaying] = useState(false)
  const [scenario, setScenarioState] = useState<Scenario>(initial.scenario)
  useAutoplay(initial.period !== null, setPlaying)

  // An operator's edits are inputs, like the units taken offline: every page solves the same fleet.
  const { edits } = useSession()
  const fleet = applyEdits(UNITS, edits)
  const solution = solve(offline, scenario, fleet)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(
      () => setPeriodState((p) => (p + 1) % PERIODS),
      TICK_MS
    )
    return () => window.clearInterval(id)
  }, [playing])

  useEffect(() => {
    publishGridState(offline, period, scenario, edits)
    writeUrlState({ offline, period, scenario, playing })
  }, [offline, period, scenario, edits, playing])

  /*
   * A trip is solved against the half-hour as it stood before the unit went, so it is worked out
   * here, at the one place every "take it out" — the scene, the diagram, the fleet — passes
   * through, from the latest solution rather than the one this callback was created with.
   */
  const [lastTrip, setLastTrip] = useState<TripEvent | null>(null)
  const latest = useRef({ offline, now: solution.periods[period] as Period })
  useEffect(() => {
    latest.current = { offline, now: solution.periods[period] as Period }
  })
  const toggle = useCallback((id: string) => {
    const { offline: out, now } = latest.current
    if (!out.includes(id)) {
      const transient = trip(now, id)
      const unit = now.outputs.find((o) => o.unit.id === id)?.unit
      if (transient && unit)
        setLastTrip({ unit, transient, at: performance.now() })
    }
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
    units: fleet,
    lastTrip,
  }

  return <GridContext.Provider value={grid}>{children}</GridContext.Provider>
}
