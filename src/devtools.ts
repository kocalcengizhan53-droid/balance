import { BASELINE, solve, type Scenario } from "@/lib/grid/dispatch"
import { applyEdits, type Edits } from "@/lib/grid/edits"
import { PERIODS } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"

/**
 * QA hook: the model the page is drawn from, plus what the page is currently showing.
 *
 * The project's one rule is that every figure on screen is solved from `src/lib/grid/` and
 * nothing is typed into a component. A unit test cannot check that — it can only check the
 * solver. Exposing the solver and the view's inputs lets a browser test re-solve the same day
 * and compare the result against the text actually painted, which is the only place the rule
 * can actually be broken.
 *
 * Active in `vite dev` and in builds made with VITE_QA_HOOK=true. A normal production build
 * returns before exposing anything.
 */
const api = {
  solve,
  applyEdits,
  units: UNITS,
  periodCount: PERIODS,
  /** The view's inputs, republished by useGrid whenever they change. */
  state: {
    offline: [] as readonly string[],
    period: 0,
    scenario: BASELINE as Scenario,
    edits: {} as Edits,
  },
}

declare global {
  interface Window {
    __app?: typeof api
  }
}

export function installDevtools() {
  if (!import.meta.env.DEV && import.meta.env.VITE_QA_HOOK !== "true") return
  window.__app = api
}

export function publishGridState(
  offline: readonly string[],
  period: number,
  scenario: Scenario,
  edits: Edits
) {
  if (window.__app) window.__app.state = { offline, period, scenario, edits }
}
