import { Button } from "@/components/ui/button"
import { DispatchChart } from "@/features/dashboard/DispatchChart"
import { KpiCard } from "@/features/dashboard/KpiCard"
import { ScenarioPanel } from "@/features/dashboard/ScenarioPanel"
import { useGrid } from "@/features/dashboard/useGrid"
import { dayStats } from "@/lib/grid/analysis"
import { BASELINE, solve, type Scenario } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"

const PRESETS: { name: string; note: string; scenario: Scenario }[] = [
  { name: "Baseline", note: "The day as modelled", scenario: BASELINE },
  {
    name: "Heatwave",
    note: "+15% demand all day",
    scenario: { ...BASELINE, demandScale: 1.15 },
  },
  {
    name: "Still day",
    note: "Wind at 30%",
    scenario: { ...BASELINE, windScale: 0.3 },
  },
  {
    name: "Carbon £80",
    note: "Gas behind biomass",
    scenario: { ...BASELINE, carbonPrice: 80 },
  },
  {
    name: "Bad evening",
    note: "Calm, hot, priced",
    scenario: { carbonPrice: 60, demandScale: 1.1, windScale: 0.4 },
  },
]

/**
 * What if. The levers, a few presets worth pressing, and the day under them beside the day
 * as it was — every comparison a pair of solves of the same model, nothing interpolated.
 */
export function ScenariosPage() {
  const grid = useGrid()
  const { periods, period, offline, scenario, setScenario } = grid
  const here = dayStats({ periods, offline, scenario })
  const base = dayStats(solve(offline, BASELINE))
  const same = (a: Scenario, b: Scenario) =>
    a.carbonPrice === b.carbonPrice &&
    a.demandScale === b.demandScale &&
    a.windScale === b.windScale

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pull a lever and the day re-solves. Every figure below is this
          scenario against the baseline, both solved from the same model.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <ScenarioPanel className="panel" />
          <section className="panel px-4 py-3.5">
            <h2 className="label">Presets</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {PRESETS.map((p) => (
                <li key={p.name}>
                  <Button
                    variant={same(p.scenario, scenario) ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => setScenario(p.scenario)}
                    aria-pressed={same(p.scenario, scenario)}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs opacity-70">{p.note}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label="Cost of the day"
              value={here.costGBP / 1e6}
              previous={base.costGBP / 1e6}
              decimals={2}
              prefix="£"
              unit="M"
              goodWhen="down"
              insight={`Baseline £${(base.costGBP / 1e6).toFixed(2)}M`}
              basis="This scenario vs baseline"
            />
            <KpiCard
              label="Carbon, day average"
              value={here.carbon}
              previous={base.carbon}
              unit="gCO₂/kWh"
              goodWhen="down"
              insight={`Baseline ${Math.round(base.carbon)}`}
              basis="Energy-weighted"
            />
            <KpiCard
              label="Imported"
              value={here.importMWh / 1000}
              previous={base.importMWh / 1000}
              decimals={1}
              unit="GWh"
              goodWhen="down"
              insight={`Baseline ${(base.importMWh / 1000).toFixed(1)} GWh`}
              basis="Through the link"
            />
            <KpiCard
              label="Periods short"
              value={here.periodsShort}
              previous={base.periodsShort}
              unit="of 48"
              goodWhen="down"
              tone={here.periodsShort ? "warning" : "normal"}
              insight={
                here.periodsShort
                  ? `Worst ${Math.round(here.worstShortMW).toLocaleString("en-GB")} MW`
                  : "Demand met all day"
              }
              basis={`Baseline ${base.periodsShort}`}
            />
          </div>
          <DispatchChart
            periods={periods}
            period={period}
            onSelect={grid.setPeriod}
          />
          <p className="text-xs text-muted-foreground">
            Peak price £{Math.round(here.peakPrice)} at{" "}
            {periodLabel(here.peakPricePeriod)} ·{" "}
            {(here.curtailedMWh / 1000).toFixed(1)} GWh of free fuel spilled ·{" "}
            {(here.exportMWh / 1000).toFixed(1)} GWh exported
          </p>
        </div>
      </div>
    </div>
  )
}
