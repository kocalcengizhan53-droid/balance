import { Outlet } from "react-router"

import { ThemeToggle } from "@/features/layout/ThemeToggle"

export function AppLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border/60 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[120rem] items-center gap-4 px-4 sm:px-6">
          <span className="text-[0.9375rem] font-semibold tracking-tight">Balance</span>
          <span className="text-muted-foreground hidden text-xs tracking-wide uppercase sm:inline">
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
