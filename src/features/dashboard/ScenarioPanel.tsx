import { useId } from "react"

import { useGrid } from "@/features/dashboard/useGrid"
import { BASELINE, type Scenario } from "@/lib/grid/dispatch"

/**
 * The levers.
 *
 * Three inputs to the same solver, each one a question a visitor might actually ask of a
 * grid: what does a carbon price do to the merit order, what does a heatwave do to the
 * evening peak, what happens on a still day. Nothing here edits a result; each slider changes
 * an input and every instrument on the page re-reads the day.
 */
type Lever = {
  key: keyof Scenario
  label: string
  min: number
  max: number
  step: number
  /** How the value reads beside the slider. */
  show: (v: number) => string
}

const LEVERS: readonly Lever[] = [
  {
    key: "carbonPrice",
    label: "Carbon price",
    min: 0,
    max: 150,
    step: 5,
    show: (v) => `£${v}/t`,
  },
  {
    key: "demandScale",
    label: "Demand",
    min: 0.8,
    max: 1.25,
    step: 0.01,
    show: (v) => `${v >= 1 ? "+" : "−"}${Math.abs(Math.round((v - 1) * 100))}%`,
  },
  {
    key: "windScale",
    label: "Wind",
    min: 0.2,
    max: 1.3,
    step: 0.05,
    show: (v) => `${Math.round(v * 100)}%`,
  },
]

export function ScenarioPanel({ className = "" }: { className?: string }) {
  const { scenario, setScenario, resetScenario } = useGrid()
  const id = useId()
  const touched = LEVERS.some((l) => scenario[l.key] !== BASELINE[l.key])

  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`flex flex-col gap-3 px-4 py-3.5 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`${id}-h`} className="label text-foreground/80">
          Scenario
        </h2>
        {touched ? (
          <button
            type="button"
            onClick={resetScenario}
            className="label text-live underline-offset-2 hover:underline"
          >
            Reset
          </button>
        ) : (
          <span className="label">baseline</span>
        )}
      </div>

      {LEVERS.map((lever) => {
        const value = scenario[lever.key]
        return (
          <label key={lever.key} className="grid gap-1.5">
            <span className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{lever.label}</span>
              <span className="figure font-medium">{lever.show(value)}</span>
            </span>
            <input
              type="range"
              min={lever.min}
              max={lever.max}
              step={lever.step}
              value={value}
              aria-valuetext={lever.show(value)}
              onChange={(e) =>
                setScenario({ [lever.key]: Number(e.target.value) })
              }
              className="h-1 w-full cursor-pointer accent-live"
            />
          </label>
        )
      })}
    </section>
  )
}
