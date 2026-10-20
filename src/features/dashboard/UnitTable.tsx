import { FUEL_LABEL, fuelVar, type Series } from "@/lib/viz/fuel"
import type { Period } from "@/lib/grid/dispatch"
import type { Unit } from "@/lib/grid/units"

/**
 * The fleet, and the switch.
 *
 * This is the only control that changes the answer rather than the view: taking a unit out
 * re-solves the whole day, and everything above re-reads from that solution. What a reader
 * is meant to notice is that the balance still holds — the system finds the megawatts
 * somewhere, and the price and the carbon say what it cost to find them.
 */
export function UnitTable({
  units,
  now,
  offline,
  onToggle,
  onRestore,
}: {
  units: readonly Unit[]
  now: Period
  offline: readonly string[]
  onToggle: (id: string) => void
  onRestore: () => void
}) {
  const outputOf = (id: string) => now.outputs.find((o) => o.unit.id === id)

  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Fleet</h2>
        {offline.length > 0 ? (
          <button
            type="button"
            onClick={onRestore}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Return {offline.length} unit{offline.length > 1 ? "s" : ""} to
            service
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Press a unit to take it offline
          </p>
        )}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">
          Generating units, their output in the selected period, and whether
          they are in service
        </caption>
        <thead>
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Unit
            </th>
            <th
              scope="col"
              className="hidden px-2 py-2 text-right font-medium sm:table-cell"
            >
              £/MWh
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Output
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Capacity
            </th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const out = outputOf(unit.id)
            const isOffline = offline.includes(unit.id)
            const mw = out?.mw ?? 0
            const loaded = out && out.available > 0 ? mw / out.available : 0
            return (
              <tr
                key={unit.id}
                className={`border-b border-border/40 last:border-0 ${isOffline ? "opacity-45" : ""}`}
              >
                <th scope="row" className="px-4 py-1.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onToggle(unit.id)}
                    aria-pressed={isOffline}
                    className="group flex min-h-9 w-full items-center gap-2.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: fuelVar(unit.fuel as Series) }}
                    />
                    <span className="underline-offset-2 group-hover:underline">
                      {unit.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {FUEL_LABEL[unit.fuel as Series]}
                    </span>
                    {isOffline ? (
                      <span className="ml-auto text-xs font-medium text-destructive">
                        offline
                      </span>
                    ) : null}
                  </button>
                </th>
                <td className="hidden px-2 py-1.5 text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                  {unit.marginalCost > 0 ? unit.marginalCost : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {Math.round(mw)}
                </td>
                <td className="px-4 py-1.5 text-right">
                  {/*
                    A meter rather than a second number: how hard the unit is working is the
                    thing being compared down the column, and a bar compares at a glance where
                    a pair of figures does not.
                  */}
                  <span className="flex items-center justify-end gap-2">
                    <span className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.round(loaded * 100)}%`,
                          backgroundColor: fuelVar(unit.fuel as Series),
                        }}
                      />
                    </span>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                      {unit.capacity}
                    </span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
