import {
  Factory,
  LayoutDashboard,
  LineChart,
  SlidersHorizontal,
} from "lucide-react"

/** The four places a visitor can go. Shared by the rail, the header and the palette. */
export const PAGES = [
  { to: "/", title: "Overview", icon: LayoutDashboard },
  { to: "/fleet", title: "Fleet", icon: Factory },
  { to: "/market", title: "Market", icon: LineChart },
  { to: "/scenarios", title: "Scenarios", icon: SlidersHorizontal },
] as const
