import { useId, useState } from "react"
import { motion } from "motion/react"

import { useElementWidth } from "@/components/use-element-width"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
 * A range control narrows the window the way every product chart does — the whole day, the
 * morning rise, the evening peak, the night — and a readout follows the pointer. Drawn as
 * polygons from the solved periods rather than by a chart library, so the geometry comes from
 * the same numbers as the tiles and cannot disagree with them.
 */

const PAD = { top: 12, right: 8, bottom: 22, left: 44 }
const GAP = 2
const EASE = { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as const
const FOLLOW = { duration: 0.22, ease: "easeOut" } as const

const RANGES = {
  day: { label: "Full day", from: 0, to: 47 },
  morning: { label: "Morning", from: 10, to: 24 },
  peak: { label: "Evening peak", from: 30, to: 44 },
  night: { label: "Night", from: 40, to: 47 },
} as const
type RangeKey = keyof typeof RANGES

type Stack = { series: Series; points: { x: number; y0: number; y1: number }[] }

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
  const [box, measured] = useElementWidth(1000)
  const [hover, setHover] = useState<number | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [rangeKey, setRangeKey] = useState<RangeKey>("day")
  const range = RANGES[rangeKey]
  const active = hover ?? period

  const W = Math.max(320, measured)
  const H = Math.round(Math.min(400, Math.max(210, W * 0.26)))
  const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

  const shown = periods.filter(
    (p) => p.period >= range.from && p.period <= range.to
  )
  const peak = Math.max(
    ...periods.map(
      (p) =>
        p.outputs.reduce((s, o) => s + o.mw, 0) + Math.max(0, p.interconnector)
    ),
    ...periods.map((p) => p.demand)
  )
  const max = Math.ceil(peak / 1000) * 1000
  const span = Math.max(1, range.to - range.from)
  const x = (i: number) => PAD.left + ((i - range.from) / span) * PLOT.w
  const y = (mw: number) => PAD.top + PLOT.h - (mw / max) * PLOT.h

  const running = new Map<number, number>()
  const stacks: Stack[] = FUEL_ORDER.map((series) => ({
    series,
    points: shown.map((p) => {
      const mw =
        series === "import"
          ? Math.max(0, p.interconnector)
          : p.outputs
              .filter((o) => o.unit.fuel === series)
              .reduce((s, o) => s + o.mw, 0)
      const y0 = running.get(p.period) ?? 0
      running.set(p.period, y0 + mw)
      return { x: x(p.period), y0: y(y0), y1: y(y0 + mw) }
    }),
  }))
  const area = (points: Stack["points"]) => {
    const top = points.map(
      (p) => `${p.x.toFixed(1)},${(p.y1 + GAP / 2).toFixed(1)}`
    )
    const bottom = [...points]
      .reverse()
      .map((p) => `${p.x.toFixed(1)},${p.y0.toFixed(1)}`)
    return `M${top.join("L")}L${bottom.join("L")}Z`
  }
  const demandLine = shown
    .map((p) => `${x(p.period).toFixed(1)},${y(p.demand).toFixed(1)}`)
    .join("L")
  const servedTop = (p: Period) =>
    p.outputs.reduce((s, o) => s + o.mw, 0) + Math.max(0, p.interconnector)
  const hasShortfall = shown.some((p) => p.unserved > 0.5)
  const shortfallArea = `M${shown.map((p) => `${x(p.period).toFixed(1)},${y(p.demand).toFixed(1)}`).join("L")}L${[
    ...shown,
  ]
    .reverse()
    .map(
      (p) =>
        `${x(p.period).toFixed(1)},${y(Math.min(p.demand, servedTop(p))).toFixed(1)}`
    )
    .join("L")}Z`
  const ticks = Array.from({ length: max / 2000 + 1 }, (_, i) => i * 2000)
  const labels = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round(range.from + t * span)
  )
  const now = periods[active]
  const inRange = active >= range.from && active <= range.to

  const fromClientX = (clientX: number, rect: DOMRect) =>
    Math.round(
      range.from +
        Math.max(
          0,
          Math.min(
            1,
            (((clientX - rect.left) / rect.width) * W - PAD.left) / PLOT.w
          )
        ) *
          span
    )

  return (
    <figure className="panel">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Dispatch across the day
          </h2>
          <p className="text-xs text-muted-foreground">
            Megawatts by fuel, half-hourly. The line is demand.
          </p>
        </div>
        <ToggleGroup
          value={[rangeKey]}
          onValueChange={(v) => {
            const k = (v as RangeKey[])[0]
            if (k) setRangeKey(k)
          }}
          variant="outline"
          size="sm"
          className="hidden md:flex"
          aria-label="Range"
        >
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3 text-xs">
              {RANGES[k].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={rangeKey}
          onValueChange={(v) => setRangeKey((v as RangeKey) ?? "day")}
          items={Object.fromEntries(
            (Object.keys(RANGES) as RangeKey[]).map((k) => [k, RANGES[k].label])
          )}
        >
          <SelectTrigger
            size="sm"
            className="w-36 md:hidden"
            aria-label="Range"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGES) as RangeKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {RANGES[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </figcaption>

      <div className="relative px-2 pt-2" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none"
          role="img"
          aria-label={`Dispatch by fuel, ${range.label.toLowerCase()}. At ${periodLabel(active)}, demand is ${now.demand} megawatts.`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setHover(fromClientX(e.clientX, rect))
            setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top })
          }}
          onPointerLeave={() => {
            setHover(null)
            setPointer(null)
          }}
          onPointerDown={(e) =>
            onSelect(
              fromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
            )
          }
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
          <text
            x={PAD.left + 4}
            y={PAD.top + 10}
            className="fill-muted-foreground text-[10px]"
          >
            GW
          </text>

          {stacks.map((stack) => (
            <motion.path
              key={`${stack.series}-${rangeKey}`}
              initial={false}
              animate={{ d: area(stack.points) }}
              transition={EASE}
              fill={fuelVar(stack.series)}
            />
          ))}

          {hasShortfall ? (
            <>
              <pattern
                id={`${id}-short`}
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={6}
                  className="stroke-destructive"
                  strokeWidth={2}
                />
              </pattern>
              <motion.path
                key={`short-${rangeKey}`}
                initial={false}
                animate={{ d: shortfallArea }}
                transition={EASE}
                fill={`url(#${id}-short)`}
                opacity={0.5}
              />
            </>
          ) : null}

          <motion.path
            key={`demand-${rangeKey}`}
            initial={false}
            animate={{ d: `M${demandLine}` }}
            transition={EASE}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {inRange ? (
            <motion.line
              initial={false}
              animate={{ x1: x(active), x2: x(active) }}
              transition={FOLLOW}
              y1={PAD.top}
              y2={PAD.top + PLOT.h}
              className="stroke-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}

          {labels.map((p) => (
            <text
              key={p}
              x={x(p)}
              y={H - 6}
              textAnchor={
                p === range.from ? "start" : p === range.to ? "end" : "middle"
              }
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {periodLabel(p)}
            </text>
          ))}
        </svg>

        {/* The readout that follows the pointer: the half-hour, and what was on the system. */}
        {pointer && hover !== null ? (
          <div
            className="pointer-events-none glass absolute z-10 w-44 px-3 py-2 text-xs"
            style={{
              left: Math.min(pointer.x + 14, W - 190),
              top: Math.max(8, pointer.y - 12),
            }}
            role="status"
          >
            <p className="mb-1.5 flex items-baseline justify-between figure font-medium">
              <span>{periodLabel(hover)}</span>
              <span className="text-muted-foreground">
                £{Math.round(periods[hover].price)}
              </span>
            </p>
            {[...FUEL_ORDER].reverse().map((series) => {
              const mw =
                series === "import"
                  ? Math.max(0, periods[hover].interconnector)
                  : periods[hover].outputs
                      .filter((o) => o.unit.fuel === series)
                      .reduce((s, o) => s + o.mw, 0)
              if (mw < 0.5) return null
              return (
                <p key={series} className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: fuelVar(series) }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {FUEL_LABEL[series]}
                  </span>
                  <span className="ml-auto figure">
                    {Math.round(mw).toLocaleString("en-GB")}
                  </span>
                </p>
              )
            })}
            <p className="mt-1.5 flex items-center gap-2 border-t border-border/60 pt-1.5">
              <span className="h-0.5 w-2 bg-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">Demand</span>
              <span className="ml-auto figure">
                {periods[hover].demand.toLocaleString("en-GB")}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-border/60 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-live="polite"
      >
        {FUEL_ORDER.map((series) => {
          const mw =
            series === "import"
              ? Math.max(0, now.interconnector)
              : now.outputs
                  .filter((o) => o.unit.fuel === series)
                  .reduce((s, o) => s + o.mw, 0)
          return (
            <div key={series} className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: fuelVar(series) }}
              />
              <span className="figure text-sm font-medium">
                {Math.round(mw)}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {FUEL_LABEL[series]}
              </span>
            </div>
          )
        })}
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 h-0.5 w-2.5 shrink-0 bg-foreground"
          />
          <span className="figure text-sm font-medium">{now.demand}</span>
          <span className="text-xs text-muted-foreground">Demand</span>
        </div>
      </div>

      <label
        className="flex items-center gap-3 border-t border-border/60 px-4 py-3"
        htmlFor={id}
      >
        <span className="shrink-0 text-xs text-muted-foreground">Time</span>
        <input
          id={id}
          type="range"
          min={0}
          max={PERIODS - 1}
          step={1}
          value={period}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-valuetext={periodLabel(period)}
          className="h-1 w-full cursor-pointer accent-live"
        />
        <span className="shrink-0 figure text-sm font-medium">
          {periodLabel(period)}
        </span>
      </label>
    </figure>
  )
}
