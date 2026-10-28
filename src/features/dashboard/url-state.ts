import { BASELINE, type Scenario } from "@/lib/grid/dispatch"
import { PERIODS } from "@/lib/grid/profiles"
import { UNITS } from "@/lib/grid/units"

/**
 * The view's inputs, in the address bar.
 *
 * `?out=calder-a,calder-b&carbon=60&demand=1.1&wind=0.4&t=36` is a scenario somebody can send
 * to somebody else, and a reload is not a reset. Only inputs are stored — never a result — and
 * only values that differ from the defaults, so the baseline at 18:00 is a bare URL.
 */
export type UrlState = {
  readonly offline: readonly string[]
  readonly period: number | null
  readonly scenario: Scenario
}

const ids = new Set(UNITS.map((u) => u.id))
const num = (v: string | null, lo: number, hi: number) => {
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

export function readUrlState(): UrlState {
  const q = new URLSearchParams(window.location.search)
  const offline = (q.get("out") ?? "").split(",").filter((id) => ids.has(id))
  const period = num(q.get("t"), 0, PERIODS - 1)
  return {
    offline,
    period: period === null ? null : Math.round(period),
    scenario: {
      carbonPrice: num(q.get("carbon"), 0, 150) ?? BASELINE.carbonPrice,
      demandScale: num(q.get("demand"), 0.8, 1.25) ?? BASELINE.demandScale,
      windScale: num(q.get("wind"), 0.2, 1.3) ?? BASELINE.windScale,
    },
  }
}

export function writeUrlState({
  offline,
  period,
  scenario,
  playing = false,
}: {
  offline: readonly string[]
  period: number
  scenario: Scenario
  /** A running clock is not a half-hour anyone chose: the link says it plays instead. */
  playing?: boolean
}) {
  const q = new URLSearchParams()
  if (offline.length) q.set("out", [...offline].sort().join(","))
  if (playing) q.set("play", "1")
  else if (period !== 36) q.set("t", String(period))
  if (scenario.carbonPrice !== BASELINE.carbonPrice)
    q.set("carbon", String(scenario.carbonPrice))
  if (scenario.demandScale !== BASELINE.demandScale)
    q.set("demand", String(scenario.demandScale))
  if (scenario.windScale !== BASELINE.windScale)
    q.set("wind", String(scenario.windScale))
  const search = q.toString()
  const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`
  if (
    next !==
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    window.history.replaceState(window.history.state, "", next)
  }
}
