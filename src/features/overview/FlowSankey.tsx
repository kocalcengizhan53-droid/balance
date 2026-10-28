import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { useElementWidth } from "@/components/use-element-width"
import { useGrid } from "@/features/dashboard/useGrid"
import { BAR, sankeyLayout } from "@/features/overview/sankey-geometry"
import { energyFlows, NODE_ORDER, SINK_ORDER } from "@/lib/grid/flows"
import { periodLabel } from "@/lib/grid/profiles"
import { NODES, type NodeId } from "@/lib/grid/units"
import { FUEL_LABEL, FUEL_ORDER, fuelVar, type Series } from "@/lib/viz/fuel"

const TWEEN = { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as const
const SINK_LABEL = { demand: "Demand", export: "Export" } as const

type Focus = { fuel: Series } | { node: NodeId } | null

const mw = (v: number) => `${Math.round(v).toLocaleString("en-GB")} MW`

/**
 * Where the power comes from and where it goes, this half-hour: fuels on the left, the four
 * nodes of the network in the middle, demand and the strait on the right. The ribbons keep
 * their fuel's colour all the way across, so the gas that reaches demand is still orange, and
 * beads run along every ribbon in the direction the power moves. It re-solves with the clock,
 * a trip or a lever like everything else on the page.
 */
export function FlowSankey() {
  const { now } = useGrid()
  const reduced = useReducedMotion()
  const [box, measured] = useElementWidth(720)
  const [focus, setFocus] = useState<Focus>(null)

  const flows = energyFlows(now)
  const W = Math.max(300, measured)
  const narrow = W < 560
  const H = narrow ? 360 : 320
  const gutter = narrow ? 70 : 104
  const layout = sankeyLayout(flows, W, H, gutter)
  const [xs, xn, xk] = layout.columns

  const lit = (r: { fuel: Series; node: NodeId }) =>
    !focus || ("fuel" in focus ? focus.fuel === r.fuel : focus.node === r.node)

  const imported = flows.supply.import
  const readout = !focus
    ? `${mw(flows.sinks.demand)} to demand${imported > 0.5 ? ` · ${mw(imported)} imported` : ""}${flows.sinks.export > 0.5 ? ` · ${mw(flows.sinks.export)} exported` : ""}`
    : "fuel" in focus
      ? `${FUEL_LABEL[focus.fuel]} · ${mw(flows.supply[focus.fuel])} · ${Math.round((flows.supply[focus.fuel] / (flows.total || 1)) * 100)}% of supply · via ${
          flows.inflows
            .filter((f) => f.fuel === focus.fuel && f.mw > 0.5)
            .map((f) => NODES[f.node].name)
            .join(", ") || "nowhere"
        }`
      : `${NODES[focus.node].name} node · ${mw(flows.nodes[focus.node])} through it`

  return (
    <section
      className="panel flex min-w-0 flex-col gap-3 p-4 sm:p-5"
      aria-labelledby="flow-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="flow-title" className="text-sm font-semibold">
            Where the power goes
          </h2>
          <p className="mt-1 label">
            Fuel → node → demand · {periodLabel(now.period)}
          </p>
        </div>
        <p
          className="min-h-5 figure text-xs text-muted-foreground"
          aria-live="polite"
        >
          {readout}
        </p>
      </div>

      <div ref={box} className="relative w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full overflow-visible"
          role="img"
          aria-label={`Energy flow at ${periodLabel(now.period)}: ${FUEL_ORDER.filter(
            (f) => flows.supply[f] > 0.5
          )
            .map((f) => `${FUEL_LABEL[f]} ${mw(flows.supply[f])}`)
            .join(
              ", "
            )}; ${mw(flows.sinks.demand)} to demand, ${mw(flows.sinks.export)} exported.`}
          onMouseLeave={() => setFocus(null)}
        >
          <g>
            {layout.ribbons.map((r) => (
              <motion.path
                key={r.id}
                initial={{ opacity: 0, d: r.area }}
                animate={{
                  d: r.area,
                  opacity: lit(r) ? (focus ? 0.78 : 0.42) : 0.1,
                }}
                transition={TWEEN}
                fill={fuelVar(r.fuel)}
                onMouseEnter={() => setFocus({ fuel: r.fuel })}
                className="mix-blend-normal dark:mix-blend-screen"
              />
            ))}
          </g>
          {reduced ? null : (
            <g className="pointer-events-none" aria-hidden="true">
              {layout.ribbons
                .filter((r) => r.thickness > 3)
                .map((r) => (
                  <motion.path
                    key={r.id}
                    initial={{ d: r.spine }}
                    animate={{ d: r.spine, opacity: lit(r) ? 0.85 : 0 }}
                    transition={TWEEN}
                    fill="none"
                    style={{
                      stroke: `color-mix(in oklch, ${fuelVar(r.fuel)} 45%, var(--foreground))`,
                    }}
                    strokeWidth={Math.min(2.4, r.thickness * 0.35)}
                    strokeLinecap="round"
                    strokeDasharray="0.1 13.9"
                    className="stream"
                  />
                ))}
            </g>
          )}

          {/* Fuels */}
          {FUEL_ORDER.map((fuel) => {
            const b = layout.sources[fuel]
            if (!b.h) return null
            return (
              <g
                key={fuel}
                onMouseEnter={() => setFocus({ fuel })}
                className="cursor-default"
              >
                <motion.rect
                  initial={false}
                  animate={{ y: b.y, height: b.h }}
                  transition={TWEEN}
                  x={xs}
                  width={BAR}
                  rx={2}
                  fill={fuelVar(fuel)}
                />
                <motion.g
                  initial={false}
                  animate={{ y: b.y + b.h / 2 }}
                  transition={TWEEN}
                >
                  <text
                    x={xs - 8}
                    y={b.h > 22 ? -2 : 4}
                    textAnchor="end"
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {FUEL_LABEL[fuel]}
                  </text>
                  {b.h > 22 ? (
                    <text
                      x={xs - 8}
                      y={11}
                      textAnchor="end"
                      className="fill-muted-foreground font-mono text-[10px]"
                    >
                      {Math.round(b.mw).toLocaleString("en-GB")}
                    </text>
                  ) : null}
                </motion.g>
              </g>
            )
          })}

          {/* Nodes */}
          {NODE_ORDER.map((node) => {
            const b = layout.nodes[node]
            if (!b.h) return null
            return (
              <g key={node} onMouseEnter={() => setFocus({ node })}>
                <motion.rect
                  initial={false}
                  animate={{ y: b.y, height: b.h }}
                  transition={TWEEN}
                  x={xn}
                  width={BAR}
                  rx={2}
                  className="fill-foreground/85"
                />
                <motion.g
                  initial={false}
                  animate={{ y: b.y + b.h / 2 }}
                  transition={TWEEN}
                >
                  <text
                    x={xn + BAR / 2}
                    y={4}
                    textAnchor="middle"
                    className="pointer-events-none fill-foreground [stroke:var(--card)] [stroke-width:4px] font-mono text-[10px] tracking-wider uppercase [paint-order:stroke]"
                    transform={`translate(0 ${b.h > 34 ? 0 : -(b.h / 2 + 8)})`}
                  >
                    {NODES[node].name}
                  </text>
                </motion.g>
              </g>
            )
          })}

          {/* Sinks */}
          {SINK_ORDER.map((sink) => {
            const b = layout.sinks[sink]
            if (!b.h) return null
            return (
              <g key={sink}>
                <motion.rect
                  initial={false}
                  animate={{ y: b.y, height: b.h }}
                  transition={TWEEN}
                  x={xk}
                  width={BAR}
                  rx={2}
                  fill={
                    sink === "demand"
                      ? "var(--live)"
                      : "var(--muted-foreground)"
                  }
                />
                <motion.g
                  initial={false}
                  animate={{ y: b.y + b.h / 2 }}
                  transition={TWEEN}
                >
                  <text
                    x={xk + BAR + 8}
                    y={b.h > 22 ? -2 : 4}
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {SINK_LABEL[sink]}
                  </text>
                  {b.h > 22 ? (
                    <text
                      x={xk + BAR + 8}
                      y={11}
                      className="fill-muted-foreground font-mono text-[10px]"
                    >
                      {Math.round(b.mw).toLocaleString("en-GB")}
                    </text>
                  ) : null}
                </motion.g>
              </g>
            )
          })}
        </svg>
      </div>

      <table className="sr-only">
        <caption>Energy flow by fuel and node, MW</caption>
        <thead>
          <tr>
            <th scope="col">Fuel</th>
            {NODE_ORDER.map((n) => (
              <th key={n} scope="col">
                {NODES[n].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FUEL_ORDER.filter((f) => flows.supply[f] > 0.5).map((fuel) => (
            <tr key={fuel}>
              <th scope="row">{FUEL_LABEL[fuel]}</th>
              {NODE_ORDER.map((node) => (
                <td key={node}>
                  {Math.round(
                    flows.inflows.find(
                      (f) => f.fuel === fuel && f.node === node
                    )?.mw ?? 0
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
