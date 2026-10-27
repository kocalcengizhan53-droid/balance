import {
  Factory,
  ScrollText,
  LayoutDashboard,
  LineChart,
  SlidersHorizontal,
} from "lucide-react"

/** The places a visitor can go. Shared by the rail, the header and the palette. */
export const PAGES = [
  { to: "/", title: "Overview", icon: LayoutDashboard },
  { to: "/fleet", title: "Fleet", icon: Factory },
  { to: "/market", title: "Market", icon: LineChart },
  { to: "/scenarios", title: "Scenarios", icon: SlidersHorizontal },
  { to: "/audit", title: "Audit log", icon: ScrollText },
] as const
