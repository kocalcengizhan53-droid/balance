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
    <section className="border-border/70 bg-card rounded-lg border">
      <div className="border-border/60 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Fleet</h2>
        {offline.length > 0 ? (
          <button
            type="button"
            onClick={onRestore}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            Return {offline.length} unit{offline.length > 1 ? "s" : ""} to service
          </button>
        ) : (
          <p className="text-muted-foreground text-xs">Press a unit to take it offline</p>
        )}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">
          Generating units, their output in the selected period, and whether they are in service
        </caption>
        <thead>
          <tr className="text-muted-foreground border-border/60 border-b text-xs">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Unit
            </th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">
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
                className={`border-border/40 border-b last:border-0 ${isOffline ? "opacity-45" : ""}`}
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
                    <span className="group-hover:underline underline-offset-2">{unit.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {FUEL_LABEL[unit.fuel as Series]}
                    </span>
                    {isOffline ? (
                      <span className="text-destructive ml-auto text-xs font-medium">offline</span>
                    ) : null}
                  </button>
                </th>
                <td className="text-muted-foreground hidden px-2 py-1.5 text-right text-xs tabular-nums sm:table-cell">
                  {unit.marginalCost > 0 ? unit.marginalCost : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(mw)}</td>
                <td className="px-4 py-1.5 text-right">
                  {/*
                    A meter rather than a second number: how hard the unit is working is the
                    thing being compared down the column, and a bar compares at a glance where
                    a pair of figures does not.
                  */}
                  <span className="flex items-center justify-end gap-2">
                    <span className="bg-muted relative hidden h-1.5 w-20 overflow-hidden rounded-full sm:block">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.round(loaded * 100)}%`,
                          backgroundColor: fuelVar(unit.fuel as Series),
                        }}
                      />
                    </span>
                    <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
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
