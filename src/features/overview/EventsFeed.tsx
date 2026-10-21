import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Power,
  PowerOff,
  Tag,
} from "lucide-react"

import { useGrid } from "@/features/dashboard/useGrid"
import { events, type GridEvent } from "@/lib/grid/analysis"
import { periodLabel } from "@/lib/grid/profiles"

const ICON: Record<GridEvent["kind"], typeof Tag> = {
  price: Tag,
  short: AlertTriangle,
  restored: CheckCircle2,
  link: ArrowLeftRight,
  start: Power,
  stop: PowerOff,
}

/**
 * The day as a log, read backwards from the selected half-hour. Every line is a diff of the
 * solver's output between two periods, so the feed re-writes itself when a unit trips.
 */
export function EventsFeed() {
  const { periods, period, setPeriod } = useGrid()
  const log = events(periods)
  // Up to the clock, most recent first; wrap the overnight hours so the list is never empty.
  const upTo = log
    .filter((e) => e.period <= period)
    .sort((a, b) => b.period - a.period)
  const rest = log
    .filter((e) => e.period > period)
    .sort((a, b) => b.period - a.period)
  const rows = [...upTo, ...rest].slice(0, 14)

  return (
    <section className="panel flex min-h-0 flex-col" aria-label="Events">
      <div className="flex items-baseline justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Events</h2>
        <p className="text-xs text-muted-foreground">
          {log.length} today · press one to jump
        </p>
      </div>
      <ol className="max-h-[32rem] divide-y divide-border/40 overflow-y-auto">
        {rows.map((e, i) => {
          const Icon = ICON[e.kind]
          const tone =
            e.kind === "short"
              ? "text-destructive"
              : e.kind === "restored"
                ? "text-fuel-biomass"
                : e.kind === "price"
                  ? "text-live"
                  : "text-muted-foreground"
          return (
            <li key={`${e.period}-${e.kind}-${i}`}>
              <button
                type="button"
                onClick={() => setPeriod(e.period)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 ${
                  e.period === period ? "bg-muted/40" : ""
                }`}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.text}</span>
                </span>
                <span className="shrink-0 figure text-xs text-muted-foreground">
                  {periodLabel(e.period)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
