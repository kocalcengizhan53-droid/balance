import { NODE_ORDER, SINK_ORDER, type Flows, type Sink } from "@/lib/grid/flows"
import type { NodeId } from "@/lib/grid/units"
import { FUEL_ORDER, type Series } from "@/lib/viz/fuel"

/** A bar is drawn only above this; below it a fuel or node takes no height and no gap. */
export const VISIBLE_MW = 0.5
export const BAR = 10
const GAP = 8
const PAD_Y = 6

export type Bar = {
  readonly y: number
  readonly h: number
  readonly mw: number
}

export type Ribbon = {
  readonly id: string
  readonly fuel: Series
  readonly node: NodeId
  readonly sink?: Sink
  readonly mw: number
  /** The filled band. */
  readonly area: string
  /** Its centre line, which the moving beads ride. */
  readonly spine: string
  readonly thickness: number
}

export type SankeyLayout = {
  readonly columns: readonly [number, number, number]
  readonly sources: Readonly<Record<Series, Bar>>
  readonly nodes: Readonly<Record<NodeId, Bar>>
  readonly sinks: Readonly<Record<Sink, Bar>>
  readonly ribbons: readonly Ribbon[]
}

const f1 = (n: number) => n.toFixed(1)

function band(x0: number, y0: number, x1: number, y1: number, h: number) {
  const xm = (x0 + x1) / 2
  return {
    area: `M${f1(x0)},${f1(y0)}C${f1(xm)},${f1(y0)} ${f1(xm)},${f1(y1)} ${f1(x1)},${f1(y1)}L${f1(x1)},${f1(y1 + h)}C${f1(xm)},${f1(y1 + h)} ${f1(xm)},${f1(y0 + h)} ${f1(x0)},${f1(y0 + h)}Z`,
    spine: `M${f1(x0)},${f1(y0 + h / 2)}C${f1(xm)},${f1(y0 + h / 2)} ${f1(xm)},${f1(y1 + h / 2)} ${f1(x1)},${f1(y1 + h / 2)}`,
  }
}

/** One column of bars, centred, sharing the scale `k` (px per MW) with the other two. */
function stack<K extends string>(
  keys: readonly K[],
  value: (k: K) => number,
  k: number,
  height: number
) {
  const shown = keys.filter((key) => value(key) > VISIBLE_MW)
  const used =
    shown.reduce((s, key) => s + value(key) * k, 0) +
    GAP * Math.max(0, shown.length - 1)
  let y = PAD_Y + (height - 2 * PAD_Y - used) / 2
  const bars = {} as Record<K, Bar>
  for (const key of keys) {
    const mw = value(key)
    const h = mw > VISIBLE_MW ? mw * k : 0
    bars[key] = { y, h, mw }
    if (h) y += h + GAP
  }
  return bars
}

/**
 * Lays the three columns out in pixels — fuels, the four nodes, demand and export — for a box
 * `width` × `height`, leaving `gutter` on each side for the labels. One scale for all three
 * columns, so a megawatt is the same thickness wherever it is; the tallest column (the fuels,
 * which have the most gaps) sets it.
 */
export function sankeyLayout(
  flows: Flows,
  width: number,
  height: number,
  gutter: number
): SankeyLayout {
  const visible = FUEL_ORDER.filter((f) => flows.supply[f] > VISIBLE_MW).length
  const k =
    flows.total > 0
      ? (height - 2 * PAD_Y - GAP * Math.max(0, visible - 1)) / flows.total
      : 0

  const columns = [
    gutter,
    (width - BAR) / 2,
    width - gutter - BAR,
  ] as const satisfies readonly [number, number, number]
  const sources = stack(FUEL_ORDER, (f) => flows.supply[f], k, height)
  const nodes = stack(NODE_ORDER, (n) => flows.nodes[n], k, height)
  const sinks = stack(SINK_ORDER, (s) => flows.sinks[s], k, height)

  // Where the next ribbon leaves or enters each bar.
  const cursor = new Map<string, number>()
  const take = (id: string, start: number, h: number) => {
    const y = cursor.get(id) ?? start
    cursor.set(id, y + h)
    return y
  }

  const ribbons: Ribbon[] = []
  for (const f of flows.inflows) {
    if (f.mw <= 0.01) continue
    const h = f.mw * k
    const y0 = take(`s:${f.fuel}`, sources[f.fuel].y, h)
    const y1 = take(`n-in:${f.node}`, nodes[f.node].y, h)
    ribbons.push({
      id: `${f.fuel}>${f.node}`,
      ...f,
      ...band(columns[0] + BAR, y0, columns[1], y1, h),
      thickness: h,
    })
  }
  for (const f of flows.outflows) {
    if (f.mw <= 0.01) continue
    const h = f.mw * k
    const y0 = take(`n-out:${f.node}`, nodes[f.node].y, h)
    const y1 = take(`k:${f.sink}`, sinks[f.sink].y, h)
    ribbons.push({
      id: `${f.node}>${f.sink}>${f.fuel}`,
      ...f,
      ...band(columns[1] + BAR, y0, columns[2], y1, h),
      thickness: h,
    })
  }

  return { columns, sources, nodes, sinks, ribbons }
}
