import {
  costWithCarbon,
  type Period,
  type Solution,
  type UnitOutput,
} from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"
import { INTERCONNECTOR, UNITS } from "@/lib/grid/units"

/**
 * Readings derived from a solved day — the figures the pages compare, rank and list.
 *
 * Pure functions over the solution, so a card that says "+4.4% on the last half-hour" and a
 * table that says the same thing cannot disagree, and both can be tested without a browser.
 */

const HOURS = 0.5

/** Percentage change from `before` to `after`, or null where there is nothing to compare to. */
export function pct(after: number, before: number): number | null {
  if (!Number.isFinite(before) || Math.abs(before) < 1e-9) return null
  return ((after - before) / Math.abs(before)) * 100
}

export type DayStats = {
  /** Energy served, MWh. */
  readonly energyMWh: number
  /** What the day cost to serve, £: every megawatt-hour at its unit's cost, imports at the link's, exports credited. */
  readonly costGBP: number
  /** Energy-weighted carbon intensity, gCO₂/kWh. */
  readonly carbon: number
  readonly importMWh: number
  readonly exportMWh: number
  readonly curtailedMWh: number
  readonly periodsShort: number
  readonly worstShortMW: number
  readonly peakPrice: number
  readonly peakPricePeriod: number
}

export function dayStats(solution: Solution): DayStats {
  const { periods, scenario } = solution
  let energy = 0
  let cost = 0
  let grams = 0
  let imp = 0
  let exp = 0
  let curtailed = 0
  let short = 0
  let worst = 0
  let peak = -Infinity
  let peakAt = 0

  for (const p of periods) {
    const generated = p.outputs.reduce((s, o) => s + o.mw, 0)
    const imported = Math.max(0, p.interconnector)
    const exported = Math.max(0, -p.interconnector)
    const served = generated + imported
    energy += served * HOURS
    cost +=
      (p.outputs.reduce(
        (s, o) =>
          s +
          o.mw *
            costWithCarbon(
              o.unit.marginalCost,
              o.unit.carbon,
              scenario.carbonPrice
            ),
        0
      ) +
        imported *
          costWithCarbon(
            INTERCONNECTOR.importCost,
            INTERCONNECTOR.carbon,
            scenario.carbonPrice
          ) -
        exported * INTERCONNECTOR.exportPrice) *
      HOURS
    grams += p.carbonIntensity * served * HOURS
    imp += imported * HOURS
    exp += exported * HOURS
    curtailed += p.curtailed * HOURS
    if (p.unserved > 0.5) {
      short += 1
      worst = Math.max(worst, p.unserved)
    }
    if (p.price > peak) {
      peak = p.price
      peakAt = p.period
    }
  }

  return {
    energyMWh: energy,
    costGBP: cost,
    carbon: energy > 0 ? grams / energy : 0,
    importMWh: imp,
    exportMWh: exp,
    curtailedMWh: curtailed,
    periodsShort: short,
    worstShortMW: worst,
    peakPrice: peak,
    peakPricePeriod: peakAt,
  }
}

export type UnitStatus = "running" | "idle" | "offline" | "constrained"

/**
 * What a unit is doing right now. "Constrained" is the interesting one: generating at a cost
 * above the clearing price, because it was committed and cannot come off inside the period.
 */
export function unitStatus(
  out: UnitOutput,
  offline: readonly string[],
  period: Period,
  carbonPrice: number
): UnitStatus {
  if (offline.includes(out.unit.id)) return "offline"
  if (out.mw <= 0.5) return "idle"
  const cost = costWithCarbon(
    out.unit.marginalCost,
    out.unit.carbon,
    carbonPrice
  )
  return cost > period.price + 0.01 ? "constrained" : "running"
}

/** A unit's output through the day, one value per period — the sparkline. */
export function unitSeries(periods: readonly Period[], id: string): number[] {
  return periods.map((p) => p.outputs.find((o) => o.unit.id === id)?.mw ?? 0)
}

export type GridEvent = {
  readonly period: number
  readonly kind: "price" | "short" | "restored" | "link" | "start" | "stop"
  readonly text: string
}

/**
 * The day as a log: what changed from one half-hour to the next. The kind of feed a product
 * dashboard carries, and here every line is a diff of the solver's own output.
 */
export function events(periods: readonly Period[]): GridEvent[] {
  const out: GridEvent[] = []
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]
    const q = periods[(i - 1 + periods.length) % periods.length]
    const at = periodLabel(p.period)

    if (p.marginalUnit !== q.marginalUnit) {
      out.push({
        period: p.period,
        kind: "price",
        text: `${p.marginalUnit === "export" ? "Exporting" : p.marginalUnit} sets the price at £${Math.round(p.price)}`,
      })
    }
    if (p.unserved > 0.5 && q.unserved <= 0.5) {
      out.push({
        period: p.period,
        kind: "short",
        text: `Demand not met — short by ${Math.round(p.unserved).toLocaleString("en-GB")} MW`,
      })
    }
    if (p.unserved <= 0.5 && q.unserved > 0.5) {
      out.push({ period: p.period, kind: "restored", text: "Demand met again" })
    }
    if (
      Math.sign(p.interconnector) !== Math.sign(q.interconnector) &&
      Math.abs(p.interconnector) > 0.5
    ) {
      out.push({
        period: p.period,
        kind: "link",
        text: `${INTERCONNECTOR.name} ${p.interconnector > 0 ? "importing" : "exporting"} ${Math.abs(Math.round(p.interconnector)).toLocaleString("en-GB")} MW`,
      })
    }
    for (const unit of UNITS) {
      const now = p.outputs.find((o) => o.unit.id === unit.id)?.mw ?? 0
      const was = q.outputs.find((o) => o.unit.id === unit.id)?.mw ?? 0
      if (now > 0.5 && was <= 0.5) {
        out.push({
          period: p.period,
          kind: "start",
          text: `${unit.name} synchronised`,
        })
      } else if (now <= 0.5 && was > 0.5) {
        out.push({ period: p.period, kind: "stop", text: `${unit.name} off` })
      }
    }
    void at
  }
  return out
}
