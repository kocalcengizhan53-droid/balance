import { Activity } from "lucide-react"
import { NavLink, useLocation } from "react-router"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useGrid } from "@/features/dashboard/useGrid"
import { PAGES } from "@/features/layout/pages"
import { BASELINE } from "@/lib/grid/dispatch"

/**
 * The rail.
 *
 * Four places a visitor can go, each a real page with its own instruments, plus a status
 * card at the foot that reads from the same solution as everything else — so the rail says
 * "short" at the same moment the masthead frequency droops.
 */

export function AppSidebar() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const { now, offline, scenario, periods } = useGrid()
  const short = periods.filter((p) => p.unserved > 0.5).length
  const touched =
    scenario.carbonPrice !== BASELINE.carbonPrice ||
    scenario.demandScale !== BASELINE.demandScale ||
    scenario.windScale !== BASELINE.windScale

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* One landmark around the rail, so screen-reader users can jump past it; `contents` keeps
          the sidebar's own flex layout. */}
      <aside aria-label="Control room" className="contents">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<NavLink to="/" />}
                className="data-[slot=sidebar-menu-button]:p-1.5!"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <Activity className="size-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight">
                    Balance
                  </span>
                  <span className="label text-[0.625rem]">grid dispatch</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Control room</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {PAGES.map((page) => {
                  const active =
                    page.to === "/"
                      ? pathname === "/"
                      : pathname.startsWith(page.to)
                  const badge =
                    page.to === "/fleet" && offline.length
                      ? `${offline.length} out`
                      : page.to === "/scenarios" && touched
                        ? "edited"
                        : null
                  return (
                    <SidebarMenuItem key={page.to}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={page.title}
                        render={
                          <NavLink
                            to={page.to}
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                      >
                        <page.icon />
                        <span>{page.title}</span>
                      </SidebarMenuButton>
                      {badge ? (
                        <SidebarMenuBadge className="label text-[0.625rem] text-live">
                          {badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {/* The system, in one line, from the same solution as every page. */}
          <div className="panel mx-1 mb-1 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
            <p className="flex items-center justify-between label">
              <span>System</span>
              <span className={short ? "text-destructive" : "text-live"}>
                {short ? "short" : "balanced"}
              </span>
            </p>
            <p className="mt-1.5 figure text-sm">
              {(now.demand / 1000).toFixed(2)} GW ·{" "}
              <span className="text-muted-foreground">
                £{Math.round(now.price)}
              </span>
            </p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              {short
                ? `${short} of 48 periods not met`
                : `${offline.length ? `${offline.length} unit${offline.length > 1 ? "s" : ""} out · ` : ""}all 48 periods met`}
            </p>
          </div>
        </SidebarFooter>
      </aside>
      <SidebarRail />
    </Sidebar>
  )
}
