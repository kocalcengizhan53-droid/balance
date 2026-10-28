import { useId, useState, type KeyboardEvent, type MouseEvent } from "react"
import { motion } from "motion/react"
import { TriangleAlert } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useElementWidth } from "@/components/use-element-width"
import { useGrid } from "@/features/dashboard/useGrid"
import { PERIODS, periodLabel } from "@/lib/grid/profiles"
import { priceSurface, type SurfaceAxis } from "@/lib/grid/surface"

const AXES: Record<
  SurfaceAxis,
  { label: string; row: (v: number) => string; long: (v: number) => string }
> = {
  windScale: {
    label: "Wind",
    row: (v) => `${Math.round(v * 100)}%`,
    long: (v) => `wind at ${Math.round(v * 100)}%`,
  },
  carbonPrice: {
    label: "Carbon",
    row: (v) => `£${v}/t`,
    long: (v) => `carbon at £${v}/t`,
  },
  demandScale: {
    label: "Demand",
    row: (v) => `${v >= 1 ? "+" : "−"}${Math.round(Math.abs(v - 1) * 100)}%`,
    long: (v) =>
      v === 1
        ? "demand as forecast"
        : `demand ${v > 1 ? "up" : "down"} ${Math.round(Math.abs(v - 1) * 100)}%`,
  },
}

const LEFT = 52
const RIGHT = 6
const TOP = 6
const AXIS = 20

/**
 * The price of every half-hour across a lever's whole range — a "what if" surface, solved row
 * by row by the same solver as everything else. The calm evening is where it burns: low wind,
 * the peak, and the gas or the link setting the price; with plant out, cells go short. The
 * ringed cell is what the rest of the page is showing; press any cell to go there.
 */
export function PriceSurface() {
  const grid = useGrid()
  const { scenario, offline, units, period } = grid
  const [axis, setAxis] = useState<SurfaceAxis>("windScale")
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const [box, measured] = useElementWidth(720)
  const hatch = useId()

  const rows = priceSurface(axis, scenario, offline, units)
  const W = Math.max(300, measured)
  const narrow = W < 560
  const cellH = narrow ? 24 : 30
  const plotW = W - LEFT - RIGHT
  const cellW = plotW / PERIODS
  const gap = cellW > 8 ? 1.5 : 1
  const H = TOP + rows.length * cellH + AXIS

  const prices = rows.flatMap((r) =>
    r.cells.filter((c) => c.unserved <= 0.5).map((c) => c.price)
  )
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const t = (price: number) => (hi > lo ? (price - lo) / (hi - lo) : 0)
  const fill = (price: number) =>
    `color-mix(in oklch, var(--heat-hi) ${Math.round(t(price) * 100)}%, var(--heat-lo))`

  const currentRow = rows.findIndex((r) => r.current)
  const cursor = hover ?? { row: currentRow, col: period }
  const cell = rows[cursor.row]?.cells[cursor.col]
  const shortCount = rows.reduce(
    (n, r) => n + r.cells.filter((c) => c.unserved > 0.5).length,
    0
  )

  const go = (row: number, col: number) => {
    grid.setScenario({ [axis]: rows[row].value })
    grid.setPeriod(col)
  }

  const fromPointer = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W - LEFT
    const y = ((e.clientY - rect.top) / rect.height) * H - TOP
    const col = Math.floor(x / cellW)
    const row = Math.floor(y / cellH)
    return col >= 0 && col < PERIODS && row >= 0 && row < rows.length
      ? { row, col }
      : null
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      go(cursor.row, cursor.col)
      return
    }
    const d = step[e.key]
    if (!d) return
    e.preventDefault()
    setHover({
      row: Math.max(0, Math.min(rows.length - 1, cursor.row + d[0])),
      col: (cursor.col + d[1] + PERIODS) % PERIODS,
    })
  }

  const readout = cell
    ? `${AXES[axis].long(rows[cursor.row].value)} · ${periodLabel(cursor.col)} · ${
        cell.unserved > 0.5
          ? `${Math.round(cell.unserved).toLocaleString("en-GB")} MW short`
          : `£${Math.round(cell.price)}/MWh, set by ${cell.marginalUnit === "export" ? "the export price" : cell.marginalUnit}`
      }`
    : ""

  return (
    <section className="panel min-w-0" aria-labelledby="surface-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h2
            id="surface-title"
            className="text-sm font-semibold tracking-tight"
          >
            Price surface
          </h2>
          <p className="text-xs text-muted-foreground">
            Every half-hour, re-solved across a lever&apos;s range. Press a cell
            to go there.
          </p>
        </div>
        <ToggleGroup
          value={[axis]}
          onValueChange={(v) => {
            const k = (v as SurfaceAxis[])[0]
            if (k) {
              setAxis(k)
              setHover(null)
            }
          }}
          variant="outline"
          size="sm"
          aria-label="Lever"
        >
          {(Object.keys(AXES) as SurfaceAxis[]).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3 text-xs">
              {AXES[k].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div
        ref={box}
        className="mx-3 mt-3 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        role="group"
        aria-label={`Price surface by ${AXES[axis].label.toLowerCase()}. Arrow keys move, Enter goes there.`}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full cursor-crosshair touch-none"
          aria-hidden="true"
          onPointerMove={(e) => setHover(fromPointer(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const at = fromPointer(e)
            if (at) go(at.row, at.col)
          }}
        >
          <defs>
            <pattern
              id={hatch}
              width={4}
              height={4}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width={4}
                height={4}
                fill="var(--destructive)"
                opacity={0.3}
              />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={4}
                stroke="var(--destructive)"
                strokeWidth={2}
              />
            </pattern>
          </defs>

          {rows.map((r, ri) => (
            <g key={`${axis}:${r.value}`}>
              <text
                x={LEFT - 8}
                y={TOP + ri * cellH + cellH / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className={`font-mono text-[10px] tabular-nums ${r.current ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}
              >
                {AXES[axis].row(r.value)}
              </text>
              {r.cells.map((c, ci) => (
                <rect
                  key={ci}
                  x={LEFT + ci * cellW + gap / 2}
                  y={TOP + ri * cellH + gap / 2}
                  width={Math.max(1, cellW - gap)}
                  height={cellH - gap}
                  rx={cellW > 8 ? 2 : 1}
                  style={{
                    fill: c.unserved > 0.5 ? `url(#${hatch})` : fill(c.price),
                    transition: `fill 450ms ease-out ${ci * 5}ms, opacity 150ms`,
                  }}
                  opacity={
                    hover && hover.row !== ri && hover.col !== ci ? 0.55 : 1
                  }
                />
              ))}
            </g>
          ))}

          {/* Where the page is: the playhead column and the ringed cell. */}
          <motion.rect
            initial={false}
            animate={{ x: LEFT + period * cellW - 0.5 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            y={TOP - 3}
            width={cellW + 1}
            height={rows.length * cellH + 6}
            fill="none"
            className="stroke-foreground/35"
            strokeWidth={1}
            rx={3}
          />
          {currentRow >= 0 ? (
            <motion.rect
              initial={false}
              animate={{
                x: LEFT + period * cellW - 1.5,
                y: TOP + currentRow * cellH - 1.5,
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              width={cellW + 3}
              height={cellH + 3}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2}
              rx={3}
            />
          ) : null}
          {hover ? (
            <rect
              x={LEFT + hover.col * cellW}
              y={TOP + hover.row * cellH}
              width={cellW}
              height={cellH}
              fill="none"
              className="stroke-live"
              strokeWidth={2}
              rx={2}
            />
          ) : null}

          {[0, 12, 24, 36].map((p) => (
            <text
              key={p}
              x={LEFT + p * cellW}
              y={H - 5}
              className="fill-muted-foreground font-mono text-[10px] tabular-nums"
            >
              {periodLabel(p)}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-2 pb-3">
        <p className="min-h-5 figure text-xs" aria-live="polite">
          {readout}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="figure">£{Math.round(lo)}</span>
            <span
              aria-hidden="true"
              className="h-2 w-20 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--heat-lo), var(--heat-hi))",
              }}
            />
            <span className="figure">£{Math.round(hi)}</span>
          </span>
          {shortCount ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {shortCount} half-hours short
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}
