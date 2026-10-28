import type { Period } from "@/lib/grid/dispatch"
import type { Fuel } from "@/lib/grid/units"

/**
 * What the frequency does in the thirty seconds after a unit trips.
 *
 * The region runs at 50 Hz while generation and demand match. Lose a unit and the shortfall is
 * drawn out of the spinning machines' stored energy, so they slow: how fast depends on how much
 * energy is spinning — the inertia — and how far it falls depends on how quickly reserve answers.
 * Wind, solar, storage and the HVDC link are connected through inverters and spin nothing, which
 * is why a windy half-hour falls faster than a calm one for the same loss. The model is the
 * aggregated swing equation with governor droop, load damping and the batteries' fast response —
 * the textbook first approximation, with the textbook's constants — and, when reserve cannot
 * hold it, low-frequency demand disconnection: below 48.8 Hz blocks of demand are switched off,
 * 5% at a time, which is what held the British system on 9 August 2019.
 */

export const NOMINAL = 50

/** Inertia constant H, seconds: stored energy per MW of rating. Inverter plant has none. */
const INERTIA: Record<Fuel, number> = {
  nuclear: 6,
  gas: 5,
  biomass: 4.5,
  hydro: 3.5,
  wind: 0,
  solar: 0,
  battery: 0,
  import: 0,
}

/** Governor droop: a 5% fall in frequency calls for a unit's whole rating. */
const DROOP = 0.05
/** Governors and steam take seconds to deliver what they are asked for. */
const GOVERNOR_LAG_S = 4
/** Load falls with frequency: 2% of demand per 1% of frequency. */
const DAMPING = 2
/** Batteries answer below 49.9 Hz and are at full output by 49.7, in half a second. */
const FFR = { start: 0.1, full: 0.3, lagS: 0.5 }
/** Secondary reserve walks the frequency back over minutes; this is its share of thirty seconds. */
const SECONDARY_S = 45
/** Demand disconnection stages, Hz, each switching off 5% of demand. */
const LFDD_STAGES = [48.8, 48.6, 48.4, 48.2, 48.0]
const LFDD_BLOCK = 0.05

const synchronised = (p: Period, except?: string) =>
  p.outputs.filter(
    (o) => o.mw > 0.5 && INERTIA[o.unit.fuel] > 0 && o.unit.id !== except
  )

/** Kinetic energy spinning in the period, MW·s, and the synchronised rating it comes from. */
export function systemInertia(p: Period, except?: string) {
  const running = synchronised(p, except)
  return {
    energy: running.reduce(
      (s, o) => s + INERTIA[o.unit.fuel] * o.unit.capacity,
      0
    ),
    rating: running.reduce((s, o) => s + o.unit.capacity, 0),
  }
}

export type Transient = {
  /** MW the trip took off the system. */
  readonly lost: number
  /** Initial rate of change of frequency, Hz/s (negative). */
  readonly rocof: number
  /** Lowest frequency reached, Hz, and when, s. */
  readonly nadir: number
  readonly nadirAt: number
  /** Where it stands at the end of the trace, Hz. */
  readonly settled: number
  /** Kinetic energy left spinning after the trip, MW·s. */
  readonly inertia: number
  /** Demand switched off by under-frequency protection, MW, and in how many blocks. */
  readonly shed: number
  readonly blocks: number
  /** Frequency every tenth of a second for thirty seconds. */
  readonly trace: readonly { t: number; f: number }[]
}

/** The frequency after `unitId` trips in period `p`, or null if it was not generating. */
export function trip(
  p: Period,
  unitId: string,
  seconds = 30
): Transient | null {
  const out = p.outputs.find((o) => o.unit.id === unitId)
  if (!out || out.mw < 0.5) return null
  const lost = out.mw
  const { energy, rating } = systemInertia(p, unitId)
  if (energy <= 0) return null

  const headroom = synchronised(p, unitId).reduce(
    (s, o) => s + (o.available - o.mw),
    0
  )
  const batteries = p.outputs
    .filter((o) => o.unit.fuel === "battery" && o.unit.id !== unitId)
    .reduce((s, o) => s + (o.unit.capacity - o.mw), 0)

  const dt = 0.01
  let df = 0
  let governor = 0
  let battery = 0
  let secondary = 0
  let blocks = 0
  let nadir = NOMINAL
  let nadirAt = 0
  const trace: { t: number; f: number }[] = [{ t: 0, f: NOMINAL }]

  for (let step = 1; step <= seconds / dt; step++) {
    const fall = -df / NOMINAL
    const governorTarget = Math.min(headroom, (fall / DROOP) * rating)
    governor += ((governorTarget - governor) / GOVERNOR_LAG_S) * dt
    const ffrShare = Math.min(
      1,
      Math.max(0, (-df - FFR.start) / (FFR.full - FFR.start))
    )
    battery += ((ffrShare * batteries - battery) / FFR.lagS) * dt
    // Secondary reserve comes out of the same headroom the governors are already using.
    const shed = blocks * LFDD_BLOCK * p.demand
    const deficit = lost - governor - battery - shed
    secondary +=
      ((Math.min(deficit, headroom - governor) - secondary) / SECONDARY_S) * dt
    const damping = DAMPING * p.demand * fall
    df +=
      (NOMINAL / (2 * energy)) *
      (governor + battery + secondary + shed + damping - lost) *
      dt

    const f = NOMINAL + df
    while (blocks < LFDD_STAGES.length && f <= LFDD_STAGES[blocks]) blocks += 1
    if (f < nadir) [nadir, nadirAt] = [f, step * dt]
    if (step % 10 === 0) trace.push({ t: Math.round(step * dt * 10) / 10, f })
  }

  return {
    lost,
    rocof: -(lost * NOMINAL) / (2 * energy),
    nadir,
    nadirAt,
    settled: NOMINAL + df,
    inertia: energy,
    shed: blocks * LFDD_BLOCK * p.demand,
    blocks,
    trace,
  }
}

/** The frequency at time t in the trace, interpolated. */
export function frequencyAt(t: Transient, seconds: number) {
  const tr = t.trace
  if (seconds <= 0) return tr[0].f
  if (seconds >= tr[tr.length - 1].t) return tr[tr.length - 1].f
  const i = Math.min(tr.length - 2, Math.floor(seconds * 10))
  const k = (seconds - tr[i].t) / (tr[i + 1].t - tr[i].t)
  return tr[i].f + (tr[i + 1].f - tr[i].f) * k
}

/**
 * The few tens of millihertz a healthy system wanders by as load comes and goes: two slow
 * swells, deterministic, so a screenshot and a test see the same needle.
 */
export function ambient(seconds: number) {
  return (
    NOMINAL +
    0.011 * Math.sin((2 * Math.PI * seconds) / 7.3) +
    0.006 * Math.sin((2 * Math.PI * seconds) / 2.9 + 1.2)
  )
}
