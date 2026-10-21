import { useEffect, useState } from "react"
import {
  Factory,
  LayoutDashboard,
  LineChart,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react"
import { useNavigate } from "react-router"

import { useTheme } from "@/components/use-theme"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useGrid } from "@/features/dashboard/useGrid"
import { periodLabel } from "@/lib/grid/profiles"

const ICONS = {
  "/": LayoutDashboard,
  "/fleet": Factory,
  "/market": LineChart,
  "/scenarios": SlidersHorizontal,
}

/**
 * ⌘K. Every control on the site, reachable by typing: pages, the clock, the theme, any unit.
 */
export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { units, offline, toggle, restore, playing, setPlaying, setPeriod } =
    useGrid()
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const run = (fn: () => void) => () => {
    fn()
    onOpenChange(false)
    setQuery("")
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Pages, the clock, the theme, and every unit"
    >
      <Command className="rounded-xl">
        <CommandInput
          placeholder="Go to, play, trip a unit…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="Pages">
            {(Object.keys(ICONS) as (keyof typeof ICONS)[]).map((to) => {
              const Icon = ICONS[to]
              const title =
                to === "/"
                  ? "Overview"
                  : to.slice(1)[0].toUpperCase() + to.slice(2)
              return (
                <CommandItem key={to} onSelect={run(() => navigate(to))}>
                  <Icon />
                  <span>{title}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Clock">
            <CommandItem onSelect={run(() => setPlaying(!playing))}>
              {playing ? <Pause /> : <Play />}
              <span>{playing ? "Pause the day" : "Play the day"}</span>
              <CommandShortcut>Space</CommandShortcut>
            </CommandItem>
            {[0, 12, 24, 36].map((p) => (
              <CommandItem key={p} onSelect={run(() => setPeriod(p))}>
                <Zap />
                <span>Jump to {periodLabel(p)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Units">
            {units.map((unit) => {
              const out = offline.includes(unit.id)
              return (
                <CommandItem
                  key={unit.id}
                  value={`${unit.name} ${unit.fuel} ${out ? "return" : "trip"}`}
                  onSelect={run(() => toggle(unit.id))}
                >
                  <Factory />
                  <span>
                    {out ? "Return" : "Trip"} {unit.name}
                  </span>
                  <CommandShortcut className="capitalize">
                    {unit.fuel}
                  </CommandShortcut>
                </CommandItem>
              )
            })}
            {offline.length ? (
              <CommandItem onSelect={run(restore)}>
                <RotateCcw />
                <span>Return every unit to service</span>
              </CommandItem>
            ) : null}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem
              onSelect={run(() =>
                setTheme(theme === "dark" ? "light" : "dark")
              )}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>Switch to {theme === "dark" ? "light" : "dark"} theme</span>
              <CommandShortcut>D</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
