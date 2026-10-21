import { Outlet } from "react-router"

import { AnimatedNumber } from "@/components/animated-number"
import { Button } from "@/components/ui/button"
import { useGrid } from "@/features/dashboard/useGrid"
import { ThemeToggle } from "@/features/layout/ThemeToggle"
import { periodLabel } from "@/lib/grid/profiles"

/**
 * The masthead is an instrument.
 *
 * A control room's top strip carries the clock and the one figure the whole room is run on —
 * system frequency, which droops the instant demand outruns generation. Both are read from
 * the same solution as everything below, so the strip is not decoration: when the day is
 * played and the system goes short, the lamp, the clock and the frequency say so together.
 */
export function AppLayout() {
  const { now, period, playing, setPlaying } = useGrid()

  /*
   * Frequency, derived rather than typed. A real system drifts a few tens of millihertz in
   * normal operation and falls when load exceeds generation; 0.5 Hz for a full loss of supply
   * is the statutory limit that trips disconnection. The droop here is proportional to the
   * share of demand not met, so it is a reading of the solver's `unserved`, not a flourish.
   */
  const frequency = 50 - (now.unserved / now.demand) * 0.5
  const short = now.unserved > 0.5

  return (
    <div className="min-h-svh text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[120rem] items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[0.9375rem] font-semibold tracking-tight">
              Balance
            </span>
            <span className="hidden label sm:inline">grid dispatch</span>
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            {/* The clock. Amber when running, steady when held. */}
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={playing ? "led" : "led [animation:none] opacity-50"}
              />
              <span className="figure text-[0.9375rem] font-medium">
                {periodLabel(period)}
              </span>
              <span className="hidden label md:inline">
                {String(period + 1).padStart(2, "0")}/48
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              aria-pressed={playing}
              aria-label={playing ? "Pause the day" : "Play the day"}
              onClick={() => setPlaying(!playing)}
              className="min-w-[4.5rem] gap-2 figure"
            >
              <span aria-hidden="true" className="text-[0.7rem]">
                {playing ? "❚❚" : "▶"}
              </span>
              {playing ? "Pause" : "Play"}
            </Button>

            {/* System frequency: 50.00 on a balanced system, drooping when it is short. */}
            <div
              className={`hidden items-baseline gap-1.5 sm:flex ${short ? "text-destructive" : ""}`}
              aria-live="polite"
            >
              <AnimatedNumber
                value={frequency}
                decimals={2}
                className="figure text-[0.9375rem] font-medium"
              />
              <span className="label">Hz</span>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
