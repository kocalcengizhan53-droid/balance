import { useId, useState } from "react"

import { FUEL_LABEL, FUEL_ORDER, fuelVar, type Series } from "@/lib/viz/fuel"
import type { Period } from "@/lib/grid/dispatch"
import { PERIODS, periodLabel } from "@/lib/grid/profiles"

/**
 * The day, stacked.
 *
 * Forty-eight half-hours of dispatch, each band a fuel, bottom to top in the order the system
 * calls them. The demand line runs over the top: where the stack rises above it the system is
 * exporting, and where it falls short the link is importing — which is the only way to see at
 * a glance that the two are not the same thing.
 *
 * Drawn as polygons from the solved periods rather than by a chart library, so the geometry
 * comes from the same numbers as the tiles and cannot disagree with them.
 */

const W = 1000
const H = 260
const PAD = { top: 12, right: 8, bottom: 22, left: 44 }
const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

/** 2px of surface between bands, in user units, so neighbours read apart without a stroke. */
const GAP = 2

type Stack = { series: Series; points: { x: number; y0: number; y1: number }[] }

function buildStacks(periods: readonly Period[], max: number) {
  const x = (i: number) => PAD.left + (i / (PERIODS - 1)) * PLOT.w
  const y = (mw: number) => PAD.top + PLOT.h - (mw / max) * PLOT.h

  const running = new Array(periods.length).fill(0)
  return FUEL_ORDER.map((series) => {
    const points = periods.map((p, i) => {
      const mw =
        series === "import"
          ? Math.max(0, p.interconnector)
          : p.outputs
              .filter((o) => o.unit.fuel === series)
              .reduce((sum, o) => sum + o.mw, 0)
      const y0 = running[i]
      running[i] = y0 + mw
      return { x: x(i), y0: y(y0), y1: y(running[i]) }
    })
    return { series, points } satisfies Stack
  })
}

const area = (points: Stack["points"]) => {
  const top = points.map((p) => `${p.x.toFixed(1)},${(p.y1 + GAP / 2).toFixed(1)}`)
  const bottom = [...points].reverse().map((p) => `${p.x.toFixed(1)},${p.y0.toFixed(1)}`)
  return `M${top.join("L")}L${bottom.join("L")}Z`
}

export function DispatchChart({
  periods,
  period,
  onSelect,
}: {
  periods: readonly Period[]
  period: number
  onSelect: (period: number) => void
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? period

  const peak = Math.max(
    ...periods.map((p) => p.outputs.reduce((s, o) => s + o.mw, 0) + Math.max(0, p.interconnector)),
    ...periods.map((p) => p.demand),
  )
  const max = Math.ceil(peak / 1000) * 1000
  const x = (i: number) => PAD.left + (i / (PERIODS - 1)) * PLOT.w
  const y = (mw: number) => PAD.top + PLOT.h - (mw / max) * PLOT.h

  const stacks = buildStacks(periods, max)
  const demandLine = periods.map((p, i) => `${x(i).toFixed(1)},${y(p.demand).toFixed(1)}`).join("L")

  const hasShortfall = periods.some((p) => p.unserved > 0.5)
  const servedTop = (p: Period) =>
    p.outputs.reduce((s, o) => s + o.mw, 0) + Math.max(0, p.interconnector)
  const shortfallArea = `M${periods.map((p, i) => `${x(i).toFixed(1)},${y(p.demand).toFixed(1)}`).join("L")}L${[...periods]
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `${x(i).toFixed(1)},${y(Math.min(p.demand, servedTop(p))).toFixed(1)}`)
    .join("L")}Z`
  const ticks = Array.from({ length: max / 2000 + 1 }, (_, i) => i * 2000)
  const now = periods[active]

  const fromClientX = (clientX: number, box: DOMRect) => {
    const ratio = (clientX - box.left) / box.width
    return Math.round(Math.max(0, Math.min(1, (ratio * W - PAD.left) / PLOT.w)) * (PERIODS - 1))
  }

  return (
    <figure className="border-border/70 bg-card rounded-lg border">
      <figcaption className="border-border/60 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Dispatch across the day</h2>
        <p className="text-muted-foreground text-xs">
          Megawatts by fuel, half-hourly. The line is demand.
        </p>
      </figcaption>

      <div className="px-2 pt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none"
          role="img"
          aria-label={`Dispatch by fuel across the day. At ${periodLabel(active)}, demand is ${now.demand} megawatts.`}
          onPointerMove={(e) => setHover(fromClientX(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => onSelect(fromClientX(e.clientX, e.currentTarget.getBoundingClientRect()))}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={W - PAD.right}
                y2={y(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {t / 1000}
              </text>
            </g>
          ))}
          {/* Over the plot, not on the axis: at the axis it printed on top of the top tick. */}
          <text x={PAD.left + 4} y={PAD.top + 10} className="fill-muted-foreground text-[10px]">
            GW
          </text>

          {stacks.map((stack) => (
            <path key={stack.series} d={area(stack.points)} fill={fuelVar(stack.series)} />
          ))}

          {/*
            The gap between what the system produced and what was asked of it.
            
            With two gas stations out the stack falls a gigawatt below the demand line for
            most of the day, and until this band was drawn the chart showed that failure as
            an absence — the one thing a control room is watching for, rendered as nothing.
            Hatched rather than filled so it reads as missing rather than as another fuel.
          */}
          {hasShortfall ? (
            <>
              <pattern
                id={`${id}-short`}
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1={0} y1={0} x2={0} y2={6} className="stroke-destructive" strokeWidth={2} />
              </pattern>
              <path d={shortfallArea} fill={`url(#${id}-short)`} opacity={0.5} />
            </>
          ) : null}

          <path
            d={`M${demandLine}`}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* The crosshair finds the X; the reader aims at a time, not at a two-pixel line. */}
          <line
            x1={x(active)}
            y1={PAD.top}
            x2={x(active)}
            y2={PAD.top + PLOT.h}
            className="stroke-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {[0, 12, 24, 36, 47].map((p) => (
            <text
              key={p}
              x={x(p)}
              y={H - 6}
              textAnchor={p === 0 ? "start" : p === 47 ? "end" : "middle"}
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {periodLabel(p)}
            </text>
          ))}
        </svg>
      </div>

      {/*
        One readout for every series at the selected time. The value leads and the name
        follows: the reader already knows which fuel they are looking at and wants the number.
        It is a list rather than a floating tooltip so the figures are reachable without a
        pointer, which the colour palette requires — three of the eight hues sit under 3:1 on
        the light surface and may not carry identity alone.
      */}
      <div
        className="border-border/60 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t px-4 py-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-live="polite"
      >
        {FUEL_ORDER.map((series) => {
          const mw =
            series === "import"
              ? Math.max(0, now.interconnector)
              : now.outputs.filter((o) => o.unit.fuel === series).reduce((s, o) => s + o.mw, 0)
          return (
            <div key={series} className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: fuelVar(series) }}
              />
              <span className="tabular-nums text-sm font-medium">{Math.round(mw)}</span>
              <span className="text-muted-foreground truncate text-xs">{FUEL_LABEL[series]}</span>
            </div>
          )
        })}
        <div className="flex items-baseline gap-2">
          <span aria-hidden="true" className="bg-foreground mt-0.5 h-0.5 w-2.5 shrink-0" />
          <span className="tabular-nums text-sm font-medium">{now.demand}</span>
          <span className="text-muted-foreground text-xs">Demand</span>
        </div>
      </div>

      <label className="border-border/60 flex items-center gap-3 border-t px-4 py-3" htmlFor={id}>
        <span className="text-muted-foreground shrink-0 text-xs">Time</span>
        <input
          id={id}
          type="range"
          min={0}
          max={PERIODS - 1}
          step={1}
          value={period}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-valuetext={periodLabel(period)}
          className="accent-foreground h-1 w-full cursor-pointer"
        />
        <span className="shrink-0 text-sm font-medium tabular-nums">{periodLabel(period)}</span>
      </label>
    </figure>
  )
}
