import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KpiCard } from "@/features/dashboard/KpiCard"
import { MeritCurve } from "@/features/dashboard/MeritCurve"
import { useGrid } from "@/features/dashboard/useGrid"
import { DaySeriesChart } from "@/features/market/DaySeriesChart"
import { dayStats } from "@/lib/grid/analysis"
import { periodLabel } from "@/lib/grid/profiles"

const PAGE = 12

/**
 * The market: what the megawatts cost and why. The supply curve for the selected half-hour,
 * the price and the carbon across the day as two charts rather than one with two axes, and
 * the settlement run as a paged table — the statement a trading desk would reconcile against.
 */
export function MarketPage() {
  const grid = useGrid()
  const { now, periods, period, offline, scenario } = grid
  const stats = dayStats({ periods, offline, scenario })
  const prev = periods[(period + 47) % 48]
  const [page, setPage] = useState(Math.floor(period / PAGE))
  const pages = Math.ceil(periods.length / PAGE)
  const rows = periods.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every megawatt-hour at the price of the last one called. Press a chart
          to move the clock.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          basis={`vs ${periodLabel(prev.period)}`}
        />
        <KpiCard
          label="Cost of the day"
          value={stats.costGBP / 1e6}
          decimals={2}
          prefix="£"
          unit="M"
          goodWhen="none"
          insight={`${Math.round(stats.energyMWh / 1000).toLocaleString("en-GB")} GWh served`}
          basis={`£${(stats.costGBP / stats.energyMWh).toFixed(1)} per MWh average`}
        />
        <KpiCard
          label="Peak price"
          value={stats.peakPrice}
          prefix="£"
          unit="/MWh"
          goodWhen="none"
          insight={`At ${periodLabel(stats.peakPricePeriod)}`}
          basis="Highest half-hour of the day"
        />
        <KpiCard
          label="Imported"
          value={stats.importMWh / 1000}
          decimals={1}
          unit="GWh"
          goodWhen="down"
          insight={`${(stats.exportMWh / 1000).toFixed(1)} GWh exported`}
          basis="Across the day, through the link"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">
        <DaySeriesChart
          title="Price across the day"
          description="System marginal price, £/MWh"
          values={periods.map((p) => p.price)}
          unit="£/MWh"
          prefix="£"
          colour="var(--live)"
          period={period}
          onSelect={grid.setPeriod}
        />
        <DaySeriesChart
          title="Carbon across the day"
          description="Intensity of everything serving demand"
          values={periods.map((p) => p.carbonIntensity)}
          unit="gCO₂/kWh"
          colour="var(--fuel-biomass)"
          period={period}
          onSelect={grid.setPeriod}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <section className="panel min-w-0">
          <div className="flex items-baseline justify-between border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Settlement run
            </h2>
            <p className="text-xs text-muted-foreground">
              48 half-hours · press a row to move the clock
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Demand</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Set by</TableHead>
                <TableHead className="text-right">Link</TableHead>
                <TableHead className="text-right">gCO₂/kWh</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow
                  key={p.period}
                  data-state={p.period === period ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => grid.setPeriod(p.period)}
                >
                  <TableCell className="figure">
                    {periodLabel(p.period)}
                  </TableCell>
                  <TableCell className="text-right figure">
                    {p.demand.toLocaleString("en-GB")}
                  </TableCell>
                  <TableCell className="text-right figure">
                    £{Math.round(p.price)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.marginalUnit === "export" ? "Export" : p.marginalUnit}
                  </TableCell>
                  <TableCell className="text-right figure text-muted-foreground">
                    {p.interconnector >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(p.interconnector)).toLocaleString(
                      "en-GB"
                    )}
                  </TableCell>
                  <TableCell className="text-right figure text-muted-foreground">
                    {Math.round(p.carbonIntensity)}
                  </TableCell>
                  <TableCell>
                    {p.unserved > 0.5 ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive"
                      >
                        short
                      </Badge>
                    ) : p.interconnector < -0.5 ? (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        exporting
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-fuel-biomass/40 text-[color-mix(in_oklab,var(--fuel-biomass)_70%,black)] dark:text-fuel-biomass"
                      >
                        balanced
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="figure">
              {periodLabel(rows[0].period)} –{" "}
              {periodLabel(rows[rows.length - 1].period)}
            </span>
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span className="figure">
                {page + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={page >= pages - 1}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </span>
          </div>
        </section>
        <MeritCurve now={now} />
      </div>
    </div>
  )
}
