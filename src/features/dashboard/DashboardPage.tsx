import { Suspense, lazy } from "react"
import { AnimatePresence, motion } from "motion/react"

import { DispatchChart } from "@/features/dashboard/DispatchChart"
import { MeritCurve } from "@/features/dashboard/MeritCurve"
import { ScenarioPanel } from "@/features/dashboard/ScenarioPanel"
import { Schematic } from "@/features/dashboard/Schematic"
import { StatTile } from "@/features/dashboard/StatTile"
import { UnitTable } from "@/features/dashboard/UnitTable"
import { useGrid } from "@/features/dashboard/useGrid"
import { energy, served } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"

/*
 * The scene is three, fiber and drei — two thirds of the bundle. It arrives in its own chunk,
 * after the instruments have painted, and the diagram holds its place until it does. A
 * visitor on a slow link reads the room first and watches it become a place.
 */
const RegionScene = lazy(() =>
  import("@/features/scene/RegionScene").then((m) => ({
    default: m.RegionScene,
  }))
)

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

  const placeholder = (
    <div className="absolute inset-0 px-4 pt-24 sm:px-6">
      <Schematic now={now} offline={grid.offline} onToggle={grid.toggle} />
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-[120rem] px-4 pb-12 sm:px-6">
      {/*
        The region first, as a place, with the instruments laid over its foot. The scene is
        the thing the rest of the page is reading; a visitor should meet it before the charts.
      */}
      <section className="relative -mx-4 sm:-mx-6">
        <div className="relative flex h-[62svh] min-h-[30rem] flex-col lg:block lg:h-[66svh] lg:min-h-[36rem]">
          {/* On a phone the title sits above the scene in flow; on a wide screen it floats over it. */}
          <div className="pointer-events-none px-4 pt-5 sm:px-6 lg:absolute lg:inset-x-6 lg:top-5 lg:z-10 lg:px-0 lg:pt-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Dispatch
            </h1>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              A fictional region, solved half-hourly. Generation equals demand
              in every period — drag to look around, press a plant to take it
              out.
            </p>
            <p className="mt-2 label">
              Settlement period {String(now.period + 1).padStart(2, "0")} of 48
              · {periodLabel(now.period)}
            </p>
          </div>
          <div className="relative min-h-0 flex-1 lg:absolute lg:inset-0">
            <Suspense fallback={placeholder}>
              <RegionScene fallback={placeholder} />
            </Suspense>
          </div>
        </div>

        {/* The instruments, riding up over the foot of the scene on a wide screen. */}
        <div className="relative z-10 grid grid-cols-2 gap-3 px-4 pt-3 sm:px-6 lg:-mt-28 lg:grid-cols-[21rem_repeat(4,minmax(0,1fr))_17rem] lg:pt-0">
          <StatTile
            hero
            label="Carbon intensity, now"
            value={now.carbonIntensity}
            unit="gCO₂/kWh"
            note={`${Math.round(dayCarbon)} across the day · ${now.marginalUnit} is setting the price`}
            className="col-span-2 lg:col-span-1"
          />
          <StatTile
            label="Demand"
            value={now.demand / 1000}
            decimals={2}
            unit="GW"
          />
          <StatTile
            label="Price"
            value={now.price}
            prefix="£"
            unit="/MWh"
            note={now.marginalUnit}
          />
          <StatTile
            label="Interconnector"
            value={Math.abs(now.interconnector)}
            prefix={now.interconnector >= 0 ? "+" : "−"}
            unit="MW"
            note={now.interconnector >= 0 ? "importing" : "exporting"}
          />
          <StatTile
            label="Spare capacity"
            value={headroom}
            unit="MW"
            note={`${Math.round(generation).toLocaleString("en-GB")} MW generating`}
            tone={headroom < 500 ? "warning" : "normal"}
          />
          <ScenarioPanel className="glass col-span-2 lg:col-span-1" />
        </div>
      </section>

      {/*
        The one condition the whole thing exists to avoid, said in words. Everything else on
        this page is a reading; this is a verdict.
      */}
      <AnimatePresence initial={false}>
        {shortfall.length > 0 ? (
          <motion.p
            key="short"
            role="alert"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 overflow-hidden rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <strong className="font-semibold">Demand not met.</strong>{" "}
            {shortfall.length} of 48 periods are short, the worst by{" "}
            {Math.round(
              Math.max(...shortfall.map((p) => p.unserved))
            ).toLocaleString("en-GB")}{" "}
            MW at{" "}
            {periodLabel(
              shortfall.reduce((a, b) => (b.unserved > a.unserved ? b : a))
                .period
            )}
            .
          </motion.p>
        ) : null}
      </AnimatePresence>

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
