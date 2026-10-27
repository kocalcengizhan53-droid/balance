import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useGrid } from "@/features/dashboard/useGrid"
import { unitSeries, unitStatus } from "@/lib/grid/analysis"
import { costWithCarbon } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"
import { FUEL_LABEL, fuelVar, type Series } from "@/lib/viz/fuel"
import { UnitEditor } from "@/features/fleet/UnitEditor"

/** A sparkline: the unit's day, 48 bars, the selected half-hour lit. */
function Sparkline({
  series,
  capacity,
  period,
  colour,
}: {
  series: number[]
  capacity: number
  period: number
  colour: string
}) {
  const W = 288
  const H = 56
  const w = W / series.length
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-14 w-full"
      role="img"
      aria-label="Output through the day"
    >
      {series.map((mw, i) => {
        const h = Math.max(1, (mw / capacity) * (H - 4))
        return (
          <rect
            key={i}
            x={i * w + 0.5}
            y={H - h}
            width={Math.max(1, w - 1)}
            height={h}
            fill={colour}
            opacity={i === period ? 1 : 0.38}
          />
        )
      })}
    </svg>
  )
}

/**
 * The row's drawer: everything the table does not have room for, and the one switch.
 */
export function UnitSheet({
  unitId,
  onClose,
}: {
  unitId: string | null
  onClose: () => void
}) {
  const { units, now, periods, period, offline, toggle, scenario } = useGrid()
  const unit = units.find((u) => u.id === unitId)
  const out = unit ? now.outputs.find((o) => o.unit.id === unit.id) : undefined
  const isOff = unit ? offline.includes(unit.id) : false

  return (
    <Sheet open={!!unit} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {unit && out ? (
          <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 pb-6">
            <SheetHeader className="px-0">
              <div className="flex items-center gap-2 pr-8">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: fuelVar(unit.fuel as Series) }}
                  aria-hidden="true"
                />
                <SheetTitle>{unit.name}</SheetTitle>
                <Badge variant="outline" className="ml-auto capitalize">
                  {unitStatus(out, offline, now, scenario.carbonPrice)}
                </Badge>
              </div>
              <SheetDescription>
                {FUEL_LABEL[unit.fuel as Series]} · {unit.node} node ·{" "}
                {unit.capacity.toLocaleString("en-GB")} MW
              </SheetDescription>
            </SheetHeader>

            <div className="panel px-4 py-3">
              <p className="label">Output at {periodLabel(period)}</p>
              <p className="mt-1 figure text-3xl font-semibold">
                {Math.round(out.mw).toLocaleString("en-GB")}
                <span className="ml-1.5 label">
                  of {Math.round(out.available).toLocaleString("en-GB")} MW
                  available
                </span>
              </p>
              <div className="mt-3">
                <Sparkline
                  series={unitSeries(periods, unit.id)}
                  capacity={unit.capacity}
                  period={period}
                  colour={fuelVar(unit.fuel as Series)}
                />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Capacity", `${unit.capacity.toLocaleString("en-GB")} MW`],
                [
                  "Minimum stable",
                  unit.minStable ? `${unit.minStable} MW` : "—",
                ],
                [
                  "Ramp rate",
                  unit.rampRate
                    ? `${unit.rampRate} MW/min`
                    : "does not follow load",
                ],
                [
                  "Marginal cost",
                  unit.marginalCost ? `£${unit.marginalCost}/MWh` : "free fuel",
                ],
                [
                  "With carbon price",
                  `£${costWithCarbon(unit.marginalCost, unit.carbon, scenario.carbonPrice).toFixed(1)}/MWh`,
                ],
                ["Emissions", `${unit.carbon} gCO₂/kWh`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="mt-0.5 figure">{v}</dd>
                </div>
              ))}
            </dl>

            {/* A fresh form per unit; after a save its fields already hold the new figures. */}
            <UnitEditor key={unit.id} unit={unit} />

            <label className="panel mt-auto flex items-center justify-between gap-4 px-4 py-3">
              <span>
                <span className="block text-sm font-medium">In service</span>
                <span className="block text-xs text-muted-foreground">
                  Taking it out re-solves the whole day
                </span>
              </span>
              <Switch
                checked={!isOff}
                onCheckedChange={() => toggle(unit.id)}
                aria-label={`${unit.name} in service`}
              />
            </label>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
