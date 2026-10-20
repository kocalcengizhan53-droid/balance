import { useElementWidth } from "@/components/use-element-width"
import { fuelVar, type Series } from "@/lib/viz/fuel"
import type { Period } from "@/lib/grid/dispatch"
import { INTERCONNECTOR } from "@/lib/grid/units"
import { periodLabel } from "@/lib/grid/profiles"

/**
 * The supply curve, and where demand cuts it.
 *
 * Every available megawatt in the period, laid out cheapest to dearest, so the step the
 * demand line lands on is the price — which is the whole mechanism behind the figure in the
 * tile above and is almost never drawn. A reader who takes a cheap unit offline watches the
 * staircase shift left and the crossing climb to the next step.
 *
 * Width is megawatts and height is £/MWh, so the area under the curve to the left of demand
 * is what the half-hour cost to serve.
 */

const PAD = { top: 14, right: 12, bottom: 26, left: 40 }

type Step = {
  label: string
  fuel: Series
  cost: number
  from: number
  to: number
}

function steps(now: Period): Step[] {
  const dispatchable = now.outputs
    .filter((o) => o.available > 0 && o.unit.marginalCost > 0)
    .map((o) => ({
      label: o.unit.name,
      fuel: o.unit.fuel as Series,
      cost: o.unit.marginalCost,
      mw: o.available,
    }))

  // Free fuel and must-run plant are price-takers: they are on the system before the market
  // is asked anything, so they sit at the left of the curve at zero.
  const free = now.outputs
    .filter((o) => o.available > 0 && o.unit.marginalCost === 0)
    .map((o) => ({
      label: o.unit.name,
      fuel: o.unit.fuel as Series,
      cost: 0,
      mw: o.available,
    }))

  const all = [
    ...free,
    ...dispatchable,
    {
      label: INTERCONNECTOR.name,
      fuel: "import" as Series,
      cost: INTERCONNECTOR.importCost,
      mw: INTERCONNECTOR.capacity,
    },
  ].sort((a, b) => a.cost - b.cost)

  let cursor = 0
  return all.map((s) => {
    const from = cursor
    cursor += s.mw
    return { label: s.label, fuel: s.fuel, cost: s.cost, from, to: cursor }
  })
}

export function MeritCurve({ now }: { now: Period }) {
  const [box, measured] = useElementWidth(560)
  const W = Math.max(320, measured)
  const H = Math.round(Math.min(440, Math.max(250, W * 0.72)))
  const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

  const curve = steps(now)
  const totalMw = curve.length > 0 ? curve[curve.length - 1].to : 1
  const maxCost =
    Math.max(INTERCONNECTOR.importCost, ...curve.map((s) => s.cost)) * 1.12

  const x = (mw: number) => PAD.left + (mw / totalMw) * PLOT.w
  const y = (cost: number) => PAD.top + PLOT.h - (cost / maxCost) * PLOT.h

  const ticks = [0, 25, 50, 75, 100].filter((t) => t <= maxCost)
  const flip = x(now.demand) > PAD.left + PLOT.w * 0.72

  return (
    <figure className="rounded-lg border border-border/70 bg-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Merit order</h2>
        <p className="text-xs text-muted-foreground">
          Every megawatt available at {periodLabel(now.period)}, cheapest first
        </p>
      </figcaption>

      <div className="px-2 pt-2" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label={`Supply curve. Demand of ${now.demand} megawatts is met at £${Math.round(now.price)} per megawatt hour, set by ${now.marginalUnit}.`}
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
                x={PAD.left - 7}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {curve.map((s) => {
            const width = Math.max(0, x(s.to) - x(s.from) - 2)
            if (width <= 0) return null
            const top = y(s.cost)
            return (
              <rect
                key={`${s.label}-${s.from}`}
                x={x(s.from) + 1}
                width={width}
                /*
                 * Free fuel has no height, because it costs nothing — correct economics and
                 * useless as a drawing. A floor of 5px keeps the WIDTH readable, which is the
                 * informative part: how much of the system is already paid for.
                 */
                height={Math.max(5, PAD.top + PLOT.h - top)}
                y={Math.min(top, PAD.top + PLOT.h - 5)}
                fill={fuelVar(s.fuel)}
                opacity={s.from < now.demand ? 1 : 0.28}
              >
                <title>{`${s.label} — £${s.cost}/MWh, ${Math.round(s.to - s.from)} MW`}</title>
              </rect>
            )
          })}

          {/* Where demand cuts the staircase: the step it lands on is the price. */}
          <line
            x1={x(now.demand)}
            y1={PAD.top}
            x2={x(now.demand)}
            y2={PAD.top + PLOT.h}
            className="stroke-foreground"
            strokeWidth={2}
          />
          {/* Flips to the inside when demand lands near the right edge, where it was clipped. */}
          <text
            x={x(now.demand) + (flip ? -6 : 6)}
            y={PAD.top + 10}
            textAnchor={flip ? "end" : "start"}
            className="fill-foreground text-[11px] font-medium"
          >
            {`£${Math.round(now.price)}`}
          </text>
          <text
            x={x(now.demand) + (flip ? -6 : 6)}
            y={PAD.top + 23}
            textAnchor={flip ? "end" : "start"}
            className="fill-muted-foreground text-[10px]"
          >
            {now.marginalUnit}
          </text>

          <text
            x={PAD.left}
            y={H - 8}
            className="fill-muted-foreground text-[10px]"
          >
            0 MW
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {Math.round(totalMw).toLocaleString()} MW available
          </text>
          <text
            x={PAD.left + 2}
            y={PAD.top + 10}
            className="fill-muted-foreground text-[10px]"
          >
            £/MWh
          </text>
        </svg>
      </div>
    </figure>
  )
}
