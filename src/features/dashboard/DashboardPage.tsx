import { DispatchChart } from "@/features/dashboard/DispatchChart"
import { MeritCurve } from "@/features/dashboard/MeritCurve"
import { Schematic } from "@/features/dashboard/Schematic"
import { UnitTable } from "@/features/dashboard/UnitTable"
import { StatTile } from "@/features/dashboard/StatTile"
import { useGrid } from "@/features/dashboard/useGrid"
import { energy, served } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"

const gw = (mw: number) => (mw / 1000).toFixed(2)

export function DashboardPage() {
  const grid = useGrid()
  const { now, periods } = grid

  const generation = now.outputs.reduce((s, o) => s + o.mw, 0)
  const headroom = now.outputs.reduce((s, o) => s + (o.available - o.mw), 0)
  const dayEnergy = energy(periods, served)
  const shortfall = periods.filter((p) => p.unserved > 0.5)
  const dayCarbon =
    periods.reduce((s, p) => s + p.carbonIntensity * served(p) * 0.5, 0) /
    dayEnergy

  return (
    <main className="mx-auto w-full max-w-[120rem] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispatch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A fictional region, solved half-hourly. Generation equals demand in
            every period.
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          Settlement period {now.period + 1} of 48 · {periodLabel(now.period)}
        </p>
      </div>

      {/*
        One hero figure per view, and it is the carbon intensity: the number that makes the
        rest of the dashboard about something. Everything else is a tile.
      */}
      <section className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div
          data-figure="Carbon intensity"
          className="rounded-lg border border-border/70 bg-card px-5 py-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Carbon intensity, now
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl leading-none font-semibold tracking-tight">
              {Math.round(now.carbonIntensity)}
            </span>
            <span className="text-sm text-muted-foreground">gCO₂/kWh</span>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {Math.round(dayCarbon)} across the day · {now.marginalUnit} is
            setting the price
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Demand" value={gw(now.demand)} unit="GW" />
          <StatTile
            label="Price"
            value={`£${Math.round(now.price)}`}
            unit="/MWh"
            note={now.marginalUnit}
          />
          <StatTile
            label="Interconnector"
            value={`${now.interconnector >= 0 ? "+" : "−"}${Math.abs(Math.round(now.interconnector))}`}
            unit="MW"
            note={now.interconnector >= 0 ? "importing" : "exporting"}
          />
          <StatTile
            label="Spare capacity"
            value={Math.round(headroom).toLocaleString()}
            unit="MW"
            note={`${Math.round(generation).toLocaleString()} MW generating`}
            tone={headroom < 500 ? "warning" : "normal"}
          />
        </div>
      </section>

      {/*
        The one condition the whole thing exists to avoid, said in words. Everything else on
        this page is a reading; this is a verdict.
      */}
      {shortfall.length > 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <strong className="font-semibold">Demand not met.</strong>{" "}
          {shortfall.length} of 48 periods are short, the worst by{" "}
          {Math.round(
            Math.max(...shortfall.map((p) => p.unserved))
          ).toLocaleString()}{" "}
          MW at{" "}
          {periodLabel(
            shortfall.reduce((a, b) => (b.unserved > a.unserved ? b : a)).period
          )}
          .
        </p>
      ) : null}

      <section className="mt-3">
        <DispatchChart
          periods={periods}
          period={grid.period}
          onSelect={grid.setPeriod}
        />
      </section>

      <section className="mt-3">
        <Schematic now={now} offline={grid.offline} onToggle={grid.toggle} />
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <UnitTable
          units={grid.units}
          now={now}
          offline={grid.offline}
          onToggle={grid.toggle}
          onRestore={grid.restore}
        />
        <MeritCurve now={now} />
      </section>
    </main>
  )
}
