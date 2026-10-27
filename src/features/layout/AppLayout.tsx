import { Suspense, lazy, useEffect, useState } from "react"
import { Pause, Play, Search } from "lucide-react"
import { Outlet, useLocation } from "react-router"

import { AnimatedNumber } from "@/components/animated-number"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useGrid } from "@/features/dashboard/useGrid"
import { AppSidebar } from "@/features/layout/AppSidebar"
import { PAGES } from "@/features/layout/pages"
import { ThemeToggle } from "@/features/layout/ThemeToggle"
import { periodLabel } from "@/lib/grid/profiles"

/**
 * The shell every product dashboard has: a rail, a header with the page's name and the
 * controls that apply everywhere, and the page. Here the controls that apply everywhere are
 * the clock and the one figure a control room is run on, system frequency — derived from the
 * solver's unserved demand, so the header says "short" the instant the model does.
 */
// The palette (cmdk, a dialog, every command) loads the first time it is asked for.
const CommandMenu = lazy(() =>
  import("@/features/layout/CommandMenu").then((m) => ({
    default: m.CommandMenu,
  }))
)

export function AppLayout() {
  const { now, period, playing, setPlaying } = useGrid()
  const { pathname } = useLocation()
  const [palette, setPalette] = useState(false)
  const [paletteLoaded, setPaletteLoaded] = useState(false)
  const openPalette = (open: boolean) => {
    if (open) setPaletteLoaded(true)
    setPalette(open)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteLoaded(true)
        setPalette((open) => !open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const page = PAGES.find((p) =>
    p.to === "/" ? pathname === "/" : pathname.startsWith(p.to)
  )

  /*
   * A real system drifts a few tens of millihertz in normal operation and falls when load
   * exceeds generation; 0.5 Hz for a full loss of supply is where disconnection begins.
   */
  const frequency = 50 - (now.unserved / now.demand) * 0.5
  const short = now.unserved > 0.5

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl sm:px-4 md:rounded-t-xl">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-1 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:block">
                  <span className="label">Balance</span>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">
                    {page?.title ?? "Overview"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPalette(true)}
                aria-label="Open the command palette"
                className="hidden gap-2 text-muted-foreground lg:inline-flex"
              >
                <Search className="size-3.5" />
                <span className="text-xs">Search</span>
                <kbd className="rounded border border-border/70 bg-muted px-1 figure text-[0.625rem]">
                  ⌘K
                </kbd>
              </Button>

              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={
                    playing ? "led" : "led [animation:none] opacity-50"
                  }
                />
                <span className="figure text-[0.9375rem] font-medium">
                  {periodLabel(period)}
                </span>
                <span className="hidden label lg:inline">
                  {String(period + 1).padStart(2, "0")}/48
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                aria-pressed={playing}
                aria-label={playing ? "Pause the day" : "Play the day"}
                onClick={() => setPlaying(!playing)}
                className="min-w-[4.5rem] gap-1.5 figure"
              >
                {playing ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {playing ? "Pause" : "Play"}
              </Button>

              <div
                className={`hidden items-baseline gap-1.5 lg:flex ${short ? "text-destructive" : ""}`}
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
          </header>
          <Outlet />
        </SidebarInset>
        {paletteLoaded ? (
          <Suspense fallback={null}>
            <CommandMenu open={palette} onOpenChange={openPalette} />
          </Suspense>
        ) : null}
      </SidebarProvider>
    </TooltipProvider>
  )
}
