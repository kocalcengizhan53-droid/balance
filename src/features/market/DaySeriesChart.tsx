import { useId, useState } from "react"
import { motion } from "motion/react"

import { useElementWidth } from "@/components/use-element-width"
import { PERIODS, periodLabel } from "@/lib/grid/profiles"

const PAD = { top: 14, right: 12, bottom: 22, left: 44 }
const EASE = { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as const

/**
 * One series across the day — price, carbon, whatever is passed — with the playhead on it and
 * a hover readout. Two of these side by side is how two measures of different scale are
 * compared: never on one chart with two y-axes.
 */
export function DaySeriesChart({
  title,
  description,
  values,
  unit,
  prefix = "",
  colour,
  period,
  onSelect,
  decimals = 0,
}: {
  title: string
  description: string
  values: readonly number[]
  unit: string
  prefix?: string
  colour: string
  period: number
  onSelect: (p: number) => void
  decimals?: number
}) {
  const gradient = useId()
  const [box, measured] = useElementWidth(560)
  const [hover, setHover] = useState<number | null>(null)
  const W = Math.max(320, measured)
  const H = Math.round(Math.min(260, Math.max(180, W * 0.42)))
  const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

  const max = Math.max(...values) * 1.12 || 1
  const x = (i: number) => PAD.left + (i / (PERIODS - 1)) * PLOT.w
  const y = (v: number) => PAD.top + PLOT.h - (v / max) * PLOT.h
  const line = values
    .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("L")
  const area = `M${line}L${x(PERIODS - 1).toFixed(1)},${(PAD.top + PLOT.h).toFixed(1)}L${x(0).toFixed(1)},${(PAD.top + PLOT.h).toFixed(1)}Z`
  const active = hover ?? period
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

  const fromClientX = (clientX: number, rect: DOMRect) =>
    Math.round(
      Math.max(
        0,
        Math.min(1, ((clientX - rect.left) / rect.width) * W - PAD.left) /
          PLOT.w
      ) *
        (PERIODS - 1)
    )

  return (
    <figure className="panel">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <p className="figure text-sm">
          {fmt(values[active])}{" "}
          <span className="label">
            {unit} · {periodLabel(active)}
          </span>
        </p>
      </figcaption>
      <div className="px-2 pt-2" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none"
          role="img"
          aria-label={`${title}: ${fmt(values[active])} ${unit} at ${periodLabel(active)}`}
          onPointerMove={(e) =>
            setHover(
              fromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
            )
          }
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) =>
            onSelect(
              fromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
            )
          }
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colour} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          <motion.path
            initial={false}
            animate={{ d: area }}
            transition={EASE}
            fill={`url(#${gradient})`}
          />
          <motion.path
            initial={false}
            animate={{ d: `M${line}` }}
            transition={EASE}
            fill="none"
            stroke={colour}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <motion.line
            initial={false}
            animate={{ x1: x(active), x2: x(active) }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            y1={PAD.top}
            y2={PAD.top + PLOT.h}
            className="stroke-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <motion.circle
            initial={false}
            animate={{ cx: x(active), cy: y(values[active]) }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            r={4}
            fill={colour}
            className="stroke-card"
            strokeWidth={2}
          />
          {[0, 12, 24, 36, 47].map((p) => (
            <text
              key={p}
              x={x(p)}
              y={H - 6}
              textAnchor={p === 0 ? "start" : p === 47 ? "end" : "middle"}
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {periodLabel(p)}
            </text>
          ))}
        </svg>
      </div>
    </figure>
  )
}
