import { createBrowserRouter } from "react-router"

import { AppLayout } from "@/features/layout/AppLayout"
import { NotFoundPage } from "@/features/layout/NotFoundPage"
import { OverviewPage } from "@/features/overview/OverviewPage"

/*
 * The overview is the landing page and ships with the app; the other pages load when they are
 * first visited, so a phone opening the overview downloads the overview.
 */
export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { index: true, Component: OverviewPage },
      {
        path: "fleet",
        lazy: async () => ({
          Component: (await import("@/features/fleet/FleetPage")).FleetPage,
        }),
      },
      {
        path: "market",
        lazy: async () => ({
          Component: (await import("@/features/market/MarketPage")).MarketPage,
        }),
      },
      {
        path: "scenarios",
        lazy: async () => ({
          Component: (await import("@/features/scenarios/ScenariosPage"))
            .ScenariosPage,
        }),
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
])
