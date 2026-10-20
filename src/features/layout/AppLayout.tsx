import { Outlet } from "react-router"

import { ThemeToggle } from "@/features/layout/ThemeToggle"

export function AppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/*
        backdrop-blur needs something to blur behind. With no background the header was a
        blurred window onto the chart rather than a bar over it — the dispatch stack smeared
        across the masthead every time the page scrolled.
      */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[120rem] items-center gap-4 px-4 sm:px-6">
          <span className="text-[0.9375rem] font-semibold tracking-tight">
            Balance
          </span>
          <span className="hidden text-xs tracking-wide text-muted-foreground uppercase sm:inline">
            grid dispatch
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
