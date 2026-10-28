import type { Period } from "@/lib/grid/dispatch"
import { INTERCONNECTOR, type NodeId } from "@/lib/grid/units"
import { FUEL_ORDER, type Series } from "@/lib/viz/fuel"

/** Top to bottom, the way the region lies on the board: wind country first, the strait last. */
export const NODE_ORDER = [
  "north",
  "west",
  "central",
  "east",
] as const satisfies readonly NodeId[]

export const SINK_ORDER = ["demand", "export"] as const
export type Sink = (typeof SINK_ORDER)[number]

/** Fuel into a node: what the plants on that node delivered this half-hour, MW. */
export type Inflow = {
  readonly fuel: Series
  readonly node: NodeId
  readonly mw: number
}

/** A node's power on its way out — to demand here or across the link — still tagged by fuel. */
export type Outflow = Inflow & { readonly sink: Sink }

export type Flows = {
  readonly supply: Readonly<Record<Series, number>>
  readonly nodes: Readonly<Record<NodeId, number>>
  readonly sinks: Readonly<Record<Sink, number>>
  /** Every fuel × node pair in drawing order, zeros included, so the shape never changes. */
  readonly inflows: readonly Inflow[]
  /** Every node × sink × fuel triple in drawing order, zeros included. */
  readonly outflows: readonly Outflow[]
  readonly total: number
}

/**
 * Where the power came from and where it went, in one half-hour.
 *
 * The bus is a copper plate (see the solver), so nothing physical says which megawatt crossed
 * the strait: an export is shared out across every node and fuel in proportion to what each
 * delivered. That is the convention a pro-rata settlement uses, and it is the only one that
 * does not invent a preference the model never made.
 *
 * Every pair is listed even at zero, because the diagram tweens between half-hours and a tween
 * needs the same shape at both ends: solar going dark is a ribbon narrowing to nothing, not
 * one disappearing.
 */
export function energyFlows(p: Period): Flows {
  const at = new Map<string, number>()
  const key = (fuel: string, node: string) => `${fuel}:${node}`
  for (const o of p.outputs) {
    const k = key(o.unit.fuel, o.unit.node)
    at.set(k, (at.get(k) ?? 0) + o.mw)
  }
  const imported = Math.max(0, p.interconnector)
  at.set(key("import", INTERCONNECTOR.node), imported)

  const inflows: Inflow[] = FUEL_ORDER.flatMap((fuel) =>
    NODE_ORDER.map((node) => ({ fuel, node, mw: at.get(key(fuel, node)) ?? 0 }))
  )
  const total = inflows.reduce((s, f) => s + f.mw, 0)
  const exported = Math.max(0, -p.interconnector)
  const share: Record<Sink, number> = {
    demand: total ? (total - exported) / total : 0,
    export: total ? exported / total : 0,
  }

  const outflows: Outflow[] = NODE_ORDER.flatMap((node) =>
    SINK_ORDER.flatMap((sink) =>
      FUEL_ORDER.map((fuel) => ({
        fuel,
        node,
        sink,
        mw: (at.get(key(fuel, node)) ?? 0) * share[sink],
      }))
    )
  )

  const sum = <T extends string>(of: readonly T[], pick: (f: Inflow) => T) =>
    Object.fromEntries(
      of.map((k) => [
        k,
        inflows.filter((f) => pick(f) === k).reduce((s, f) => s + f.mw, 0),
      ])
    ) as Record<T, number>

  return {
    supply: sum(FUEL_ORDER, (f) => f.fuel),
    nodes: sum(NODE_ORDER, (f) => f.node),
    sinks: { demand: total - exported, export: exported },
    inflows,
    outflows,
    total,
  }
}
