import { useState } from "react"

import { useGrid } from "@/features/dashboard/useGrid"
import { generationMix } from "@/lib/grid/mix"
import { periodLabel } from "@/lib/grid/profiles"
import { FUEL_LABEL, fuelVar, type Series } from "@/lib/viz/fuel"

const R = 54
const C = 2 * Math.PI * R
/** A sliver of card between slices, so neighbours never touch. */
const GAP = 2.5

/**
 * What is serving the region now, as a ring that re-shapes itself through the day: wind swells
 * overnight, solar opens at noon, gas closes the evening peak. The centre is the share that
 * emits nothing; the legend carries the figures, so the colour is never the only cue.
 */
export function MixRing() {
  const { now } = useGrid()
  const mix = generationMix(now)
  const [focus, setFocus] = useState<Series | null>(null)

  // Each slice starts where the ones before it end.
  const arcs = mix.slices.map((s, i) => ({
    ...s,
    length: Math.max(0, s.share * C - GAP),
    offset: mix.slices.slice(0, i).reduce((sum, x) => sum + x.share * C, 0),
  }))

  return (
    <section
      className="panel flex flex-col gap-4 p-4 sm:p-5"
      aria-labelledby="mix-title"
    >
      <div>
        <h2 id="mix-title" className="text-sm font-semibold">
          Generation mix
        </h2>
        <p className="mt-1 label">Now · {periodLabel(now.period)}</p>
      </div>
      <div className="grid items-center gap-5 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className="relative mx-auto size-38">
          <svg
            viewBox="0 0 140 140"
            className="size-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={70}
              cy={70}
              r={R}
              fill="none"
              className="stroke-muted-foreground/10"
              strokeWidth={14}
            />
            {arcs.map((a) => (
              <circle
                key={a.fuel}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={fuelVar(a.fuel)}
                strokeWidth={focus === a.fuel ? 18 : 14}
                strokeDasharray={`${a.length} ${C - a.length}`}
                strokeDashoffset={-a.offset}
                opacity={focus && focus !== a.fuel ? 0.3 : 1}
                className="transition-[stroke-dasharray,stroke-dashoffset,stroke-width,opacity] duration-500 ease-out"
              />
            ))}
          </svg>
          <p className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="figure text-3xl font-medium lit">
              {Math.round(mix.lowCarbonShare * 100)}%
            </span>
            <span className="label">low-carbon</span>
          </p>
        </div>
        <ul className="flex flex-col" aria-label="Generation by fuel">
          {mix.slices.map((s) => (
            <li key={s.fuel}>
              <button
                type="button"
                onMouseEnter={() => setFocus(s.fuel)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(s.fuel)}
                onBlur={() => setFocus(null)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: fuelVar(s.fuel) }}
                />
                <span className="flex-1">{FUEL_LABEL[s.fuel]}</span>
                <span className="figure text-muted-foreground">
                  {Math.round(s.mw).toLocaleString("en-GB")} MW
                </span>
                <span className="w-10 text-right figure">
                  {Math.round(s.share * 100)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
