import {
  ArrowLeftRight,
  Atom,
  BatteryCharging,
  Droplets,
  Flame,
  Leaf,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_TONE, type Row } from "@/features/fleet/fleet-columns"
import { unitSeries } from "@/lib/grid/analysis"
import type { Period } from "@/lib/grid/dispatch"
import { PERIODS } from "@/lib/grid/profiles"
import { NODES, type NodeId } from "@/lib/grid/units"
import { FUEL_LABEL, fuelVar, type Series } from "@/lib/viz/fuel"

const ICON: Record<Series, LucideIcon> = {
  nuclear: Atom,
  wind: Wind,
  solar: Sun,
  hydro: Droplets,
  biomass: Leaf,
  gas: Flame,
  battery: BatteryCharging,
  import: ArrowLeftRight,
}

const num = (v: number) => Math.round(v).toLocaleString("en-GB")

/** Half a circle, left to right: the gauge's track and its arcs share it. */
const R = 46
const ARC = Math.PI * R
const arc = `M${60 - R},56 A${R},${R} 0 0 1 ${60 + R},56`

/**
 * The fleet as a wall of instruments rather than rows: per unit, a gauge of output against
 * capacity with the weather's limit marked on it, the day's output as a trace with the clock
 * on it, and what it costs and emits. Same rows, same order and filters as the table; press a
 * card for the drawer, or the button to take the unit out.
 */
export function FleetCards({
  rows,
  periods,
  period,
  toggle,
  openUnit,
}: {
  rows: readonly Row[]
  periods: readonly Period[]
  period: number
  toggle: (id: string) => void
  openUnit: (id: string) => void
}) {
  if (!rows.length)
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No unit matches.
      </p>
    )

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3 p-3">
      {rows.map((r) => {
        const fuel = r.unit.fuel as Series
        const Icon = ICON[fuel]
        const series = unitSeries(periods, r.unit.id)
        const peak = Math.max(r.unit.capacity, 1)
        const outShare = r.out.mw / peak
        const availShare = r.out.available / peak
        const offline = r.status === "offline"
        const sx = (p: number) => 4 + (p / (PERIODS - 1)) * 192
        const sy = (v: number) => 34 - (v / peak) * 30
        const trace = series
          .map((v, p) => `${sx(p).toFixed(1)},${sy(v).toFixed(1)}`)
          .join("L")
        // Where the weather caps the gauge, as an angle along the half circle.
        const tick = Math.PI * (1 - availShare)

        return (
          <li
            key={r.unit.id}
            style={{ opacity: offline ? 0.62 : 1 }}
            className="group relative"
          >
            <div
              onClick={() => openUnit(r.unit.id)}
              className="panel flex h-full cursor-pointer flex-col gap-3 overflow-hidden p-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
              style={{
                backgroundImage: `radial-gradient(120% 70% at 50% -20%, color-mix(in oklch, ${fuelVar(fuel)} 22%, transparent), transparent 70%)`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `color-mix(in oklch, ${fuelVar(fuel)} 16%, transparent)`,
                    color: fuelVar(fuel),
                  }}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openUnit(r.unit.id)
                    }}
                    aria-label={`${r.unit.name}: ${num(r.out.mw)} of ${num(r.unit.capacity)} MW, ${r.status}. Open details`}
                    className="block max-w-full truncate rounded-sm text-left text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-[var(--radius)] focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {r.unit.name}
                  </button>
                  <span className="block truncate label">
                    {FUEL_LABEL[fuel]} · {NODES[r.unit.node as NodeId].name}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={`capitalize ${STATUS_TONE[r.status]}`}
                >
                  {r.status}
                </Badge>
              </div>

              <div className="relative mx-auto w-full max-w-[11rem] sm:max-w-[13rem]">
                <svg viewBox="0 0 120 64" className="w-full" aria-hidden="true">
                  <path
                    d={arc}
                    fill="none"
                    className="stroke-muted-foreground/15"
                    strokeWidth={9}
                    strokeLinecap="round"
                  />
                  <path
                    d={arc}
                    fill="none"
                    stroke={fuelVar(fuel)}
                    strokeOpacity={0.25}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={`${availShare * ARC} ${ARC}`}
                    className="transition-[stroke-dasharray] duration-700 ease-out"
                  />
                  <path
                    d={arc}
                    fill="none"
                    stroke={fuelVar(fuel)}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0.001, outShare * ARC)} ${ARC}`}
                    className="transition-[stroke-dasharray] duration-700 ease-out"
                    style={{
                      filter: `drop-shadow(0 0 6px color-mix(in oklch, ${fuelVar(fuel)} 55%, transparent))`,
                    }}
                  />
                  {availShare > 0 && availShare < 0.995 ? (
                    <line
                      x1={60 + (R - 8) * Math.cos(tick)}
                      y1={56 - (R - 8) * Math.sin(tick)}
                      x2={60 + (R + 8) * Math.cos(tick)}
                      y2={56 - (R + 8) * Math.sin(tick)}
                      className="stroke-foreground/60"
                      strokeWidth={1.5}
                    />
                  ) : null}
                </svg>
                <p className="absolute inset-x-0 bottom-0 text-center">
                  <span className="block figure text-2xl leading-none font-medium lit">
                    {num(r.out.mw)}
                  </span>
                  <span className="label">of {num(r.unit.capacity)} MW</span>
                </p>
              </div>

              <svg viewBox="0 0 200 38" className="w-full" aria-hidden="true">
                <path
                  d={`M${trace}L${sx(PERIODS - 1)},36L${sx(0)},36Z`}
                  fill={fuelVar(fuel)}
                  fillOpacity={0.14}
                />
                <path
                  d={`M${trace}`}
                  fill="none"
                  stroke={fuelVar(fuel)}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <circle
                  cx={sx(period)}
                  cy={sy(series[period])}
                  r={3}
                  fill={fuelVar(fuel)}
                  className="stroke-card transition-[cx,cy] duration-300 ease-out"
                  strokeWidth={1.5}
                />
              </svg>

              <div className="mt-auto flex items-end gap-2">
                <dl className="grid flex-1 grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="label">Cost</dt>
                    <dd className="figure">£{r.cost.toFixed(0)}</dd>
                  </div>
                  <div>
                    <dt className="label">Carbon</dt>
                    <dd className="figure">{r.unit.carbon} g</dd>
                  </div>
                  <div>
                    <dt className="label">Load</dt>
                    <dd className="figure">{Math.round(r.load * 100)}%</dd>
                  </div>
                </dl>
                <Button
                  size="xs"
                  variant={offline ? "default" : "outline"}
                  className="relative z-10"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(r.unit.id)
                  }}
                  aria-label={`${offline ? "Return" : "Take"} ${r.unit.name} ${offline ? "to service" : "offline"}`}
                >
                  {offline ? "Return" : "Trip"}
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
