import { createBrowserRouter } from "react-router"

import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { AppLayout } from "@/features/layout/AppLayout"

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [{ index: true, Component: DashboardPage }],
  },
])
