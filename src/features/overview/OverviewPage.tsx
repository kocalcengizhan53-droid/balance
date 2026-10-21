import { Suspense, lazy } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Link } from "react-router"

import { DispatchChart } from "@/features/dashboard/DispatchChart"
import { KpiCard } from "@/features/dashboard/KpiCard"
import { ScenarioPanel } from "@/features/dashboard/ScenarioPanel"
import { Schematic } from "@/features/dashboard/Schematic"
import { useGrid } from "@/features/dashboard/useGrid"
import { EventsFeed } from "@/features/overview/EventsFeed"
import { periodLabel } from "@/lib/grid/profiles"

/*
 * The scene is three, fiber and drei — two thirds of the bundle. It arrives in its own chunk,
 * after the instruments have painted, and the diagram holds its place until it does.
 */
const RegionScene = lazy(() =>
  import("@/features/scene/RegionScene").then((m) => ({
    default: m.RegionScene,
  }))
)

export function OverviewPage() {
  const grid = useGrid()
  const { now, periods, period } = grid
  const prev = periods[(period + 47) % 48]

  const generation = now.outputs.reduce((s, o) => s + o.mw, 0)
  const headroom = now.outputs.reduce((s, o) => s + (o.available - o.mw), 0)
  const prevHeadroom = prev.outputs.reduce(
    (s, o) => s + (o.available - o.mw),
    0
  )
  const shortfall = periods.filter((p) => p.unserved > 0.5)
  const basis = `vs ${periodLabel(prev.period)}`

  const placeholder = (
    <div className="absolute inset-0 px-4 pt-24 sm:px-6">
      <Schematic now={now} offline={grid.offline} onToggle={grid.toggle} />
    </div>
  )

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      {/* The region first, as a place, with the instruments laid over its foot. */}
      <section className="relative">
        <div className="relative flex h-[56svh] min-h-[28rem] flex-col overflow-hidden rounded-xl lg:block lg:h-[60svh] lg:min-h-[34rem]">
          <div className="pointer-events-none px-4 pt-4 sm:px-6 lg:absolute lg:inset-x-6 lg:top-5 lg:z-10 lg:px-0 lg:pt-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Overview
            </h1>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              A fictional region, solved half-hourly. Drag to look around, press
              a plant to take it out.
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

        <div className="relative z-10 grid grid-cols-2 gap-3 pt-3 lg:-mt-24 lg:grid-cols-[20rem_repeat(4,minmax(0,1fr))_16rem] lg:px-4 lg:pt-0">
          <KpiCard
            hero
            label="Carbon intensity"
            value={now.carbonIntensity}
            previous={prev.carbonIntensity}
            unit="gCO₂/kWh"
            goodWhen="down"
            insight={`${now.marginalUnit === "export" ? "Exporting" : now.marginalUnit} is setting the price`}
            basis={basis}
            className="col-span-2 lg:col-span-1"
          />
          <KpiCard
            label="Demand"
            value={now.demand / 1000}
            previous={prev.demand / 1000}
            decimals={2}
            unit="GW"
            goodWhen="none"
            insight={`${Math.round(generation).toLocaleString("en-GB")} MW generating`}
            basis={basis}
          />
          <KpiCard
            label="Price"
            value={now.price}
            previous={prev.price}
            prefix="£"
            unit="/MWh"
            goodWhen="down"
            insight={
              now.marginalUnit === "export"
                ? "Export price"
                : `Set by ${now.marginalUnit}`
            }
            basis={basis}
          />
          <KpiCard
            label="Interconnector"
            value={Math.abs(now.interconnector)}
            previous={Math.abs(prev.interconnector)}
            prefix={now.interconnector >= 0 ? "+" : "−"}
            unit="MW"
            goodWhen="none"
            insight={now.interconnector >= 0 ? "Importing" : "Exporting"}
            basis={basis}
          />
          <KpiCard
            label="Spare capacity"
            value={headroom}
            previous={prevHeadroom}
            unit="MW"
            goodWhen="up"
            tone={headroom < 500 ? "warning" : "normal"}
            insight={
              headroom < 500 ? "Reserve below 500 MW" : "Reserve healthy"
            }
            basis={basis}
          />
          <ScenarioPanel className="glass col-span-2 lg:col-span-1" />
        </div>
      </section>

      <AnimatePresence initial={false}>
        {shortfall.length > 0 ? (
          <motion.p
            key="short"
            role="alert"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
            .{" "}
            <Link to="/fleet" className="underline underline-offset-2">
              See the fleet
            </Link>
          </motion.p>
        ) : null}
      </AnimatePresence>

      <DispatchChart
        periods={periods}
        period={period}
        onSelect={grid.setPeriod}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Schematic now={now} offline={grid.offline} onToggle={grid.toggle} />
        <EventsFeed />
      </div>
    </div>
  )
}
