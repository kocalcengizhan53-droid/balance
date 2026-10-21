import { createBrowserRouter } from "react-router"

import { FleetPage } from "@/features/fleet/FleetPage"
import { AppLayout } from "@/features/layout/AppLayout"
import { MarketPage } from "@/features/market/MarketPage"
import { OverviewPage } from "@/features/overview/OverviewPage"
import { ScenariosPage } from "@/features/scenarios/ScenariosPage"

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      { index: true, Component: OverviewPage },
      { path: "fleet", Component: FleetPage },
      { path: "market", Component: MarketPage },
      { path: "scenarios", Component: ScenariosPage },
    ],
  },
])
