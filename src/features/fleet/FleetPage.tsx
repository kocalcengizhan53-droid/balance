import { useState } from "react"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  Settings2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGrid } from "@/features/dashboard/useGrid"
import { UnitSheet } from "@/features/fleet/UnitSheet"
import { unitStatus, type UnitStatus } from "@/lib/grid/analysis"
import { costWithCarbon } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"
import { FUEL_LABEL, FUEL_ORDER, fuelVar, type Series } from "@/lib/viz/fuel"

/**
 * The fleet as a product table: tabs over it, a search box, a fuel filter, a column menu,
 * row selection with a bulk action, sortable headers, status badges, a drawer per row, and a
 * pager. Every figure in it is the solver's, re-read as the clock runs.
 */

type Col =
  "status" | "output" | "load" | "capacity" | "cost" | "carbon" | "node"
const COLUMNS: { key: Col; label: string; numeric?: boolean }[] = [
  { key: "status", label: "Status" },
  { key: "output", label: "Output", numeric: true },
  { key: "load", label: "Load", numeric: true },
  { key: "capacity", label: "Capacity", numeric: true },
  { key: "cost", label: "£/MWh", numeric: true },
  { key: "carbon", label: "gCO₂/kWh", numeric: true },
  { key: "node", label: "Node" },
]
const PAGE = 8

const STATUS_TONE: Record<UnitStatus, string> = {
  running: "text-fuel-biomass border-fuel-biomass/40",
  constrained: "text-live border-live/40",
  idle: "text-muted-foreground",
  offline: "text-destructive border-destructive/40",
}

export function FleetPage() {
  const { units, now, period, offline, toggle, restore, scenario } = useGrid()
  const [tab, setTab] = useState<"all" | UnitStatus>("all")
  const [query, setQuery] = useState("")
  const [fuel, setFuel] = useState<string>("all")
  const [hidden, setHidden] = useState<Set<Col>>(new Set())
  const [sort, setSort] = useState<{ key: Col | "name"; dir: 1 | -1 }>({
    key: "output",
    dir: -1,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  const rows = units
    .map((unit) => {
      const out = now.outputs.find((o) => o.unit.id === unit.id)!
      return {
        unit,
        out,
        status: unitStatus(out, offline, now, scenario.carbonPrice),
        load: out.available > 0 ? out.mw / out.available : 0,
        cost: costWithCarbon(
          unit.marginalCost,
          unit.carbon,
          scenario.carbonPrice
        ),
      }
    })
    .filter((r) => tab === "all" || r.status === tab)
    .filter((r) => fuel === "all" || r.unit.fuel === fuel)
    .filter((r) =>
      r.unit.name.toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort((a, b) => {
      const v = (r: typeof a) =>
        sort.key === "name"
          ? r.unit.name
          : sort.key === "status"
            ? r.status
            : sort.key === "output"
              ? r.out.mw
              : sort.key === "load"
                ? r.load
                : sort.key === "capacity"
                  ? r.unit.capacity
                  : sort.key === "cost"
                    ? r.cost
                    : sort.key === "carbon"
                      ? r.unit.carbon
                      : r.unit.node
      const x = v(a),
        y = v(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE)
  const counts = { all: units.length } as Record<string, number>
  for (const r of units.map((u) =>
    unitStatus(
      now.outputs.find((o) => o.unit.id === u.id)!,
      offline,
      now,
      scenario.carbonPrice
    )
  )) {
    counts[r] = (counts[r] ?? 0) + 1
  }
  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.unit.id))
  const sortBy = (key: Col | "name") =>
    setSort((s) => ({
      key,
      dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1,
    }))
  const show = (c: Col) => !hidden.has(c)

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eleven units at {periodLabel(period)}. Press a row for the detail;
            take a unit out and the day re-solves.
          </p>
        </div>
        {offline.length ? (
          <Button variant="outline" size="sm" onClick={restore}>
            Return {offline.length} unit{offline.length > 1 ? "s" : ""} to
            service
          </Button>
        ) : null}
      </div>

      <section className="panel min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Tabs
            className="max-w-full min-w-0 overflow-x-auto"
            value={tab}
            onValueChange={(v) => {
              setTab(v as typeof tab)
              setPage(0)
            }}
          >
            <TabsList className="max-w-full justify-start overflow-x-auto">
              {(
                ["all", "running", "constrained", "idle", "offline"] as const
              ).map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {t}
                  <span className="ml-1.5 figure text-[0.6875rem] text-muted-foreground">
                    {counts[t] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder="Find a unit"
                aria-label="Find a unit"
                className="h-8 w-44 pl-8"
              />
            </label>
            <Select
              value={fuel}
              onValueChange={(v) => {
                setFuel(String(v ?? "all"))
                setPage(0)
              }}
              items={{
                all: "All fuels",
                ...Object.fromEntries(
                  FUEL_ORDER.filter((f) => f !== "import").map((f) => [
                    f,
                    FUEL_LABEL[f],
                  ])
                ),
              }}
            >
              <SelectTrigger size="sm" aria-label="Fuel" className="w-32">
                <SelectValue placeholder="Fuel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fuels</SelectItem>
                {FUEL_ORDER.filter((f) => f !== "import").map((f) => (
                  <SelectItem key={f} value={f}>
                    {FUEL_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                <Settings2 /> Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Show</DropdownMenuLabel>
                  {COLUMNS.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={show(c.key)}
                      onCheckedChange={(on) =>
                        setHidden((h) => {
                          const n = new Set(h)
                          if (on) n.delete(c.key)
                          else n.add(c.key)
                          return n
                        })
                      }
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selected.size ? (
          <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <span className="figure">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                for (const id of selected) if (!offline.includes(id)) toggle(id)
                setSelected(new Set())
              }}
            >
              Take offline
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                for (const id of selected) if (offline.includes(id)) toggle(id)
                setSelected(new Set())
              }}
            >
              Return to service
            </Button>
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(on) =>
                    setSelected((s) => {
                      const n = new Set(s)
                      for (const r of visible) {
                        if (on) n.add(r.unit.id)
                        else n.delete(r.unit.id)
                      }
                      return n
                    })
                  }
                  aria-label="Select all on this page"
                />
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => sortBy("name")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Unit <ArrowUpDown className="size-3" />
                </button>
              </TableHead>
              {COLUMNS.filter((c) => show(c.key)).map((c) => (
                <TableHead
                  key={c.key}
                  className={c.numeric ? "text-right" : ""}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label} <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow
                key={r.unit.id}
                data-state={selected.has(r.unit.id) ? "selected" : undefined}
                className={`cursor-pointer ${r.status === "offline" ? "opacity-60" : ""}`}
                onClick={() => setOpen(r.unit.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(r.unit.id)}
                    onCheckedChange={(on) =>
                      setSelected((s) => {
                        const n = new Set(s)
                        if (on) n.add(r.unit.id)
                        else n.delete(r.unit.id)
                        return n
                      })
                    }
                    aria-label={`Select ${r.unit.name}`}
                  />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: fuelVar(r.unit.fuel as Series),
                      }}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{r.unit.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {FUEL_LABEL[r.unit.fuel as Series]}
                    </span>
                  </span>
                </TableCell>
                {show("status") ? (
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_TONE[r.status]}`}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                ) : null}
                {show("output") ? (
                  <TableCell className="text-right figure">
                    {Math.round(r.out.mw).toLocaleString("en-GB")}
                  </TableCell>
                ) : null}
                {show("load") ? (
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.round(r.load * 100)}%`,
                            backgroundColor: fuelVar(r.unit.fuel as Series),
                          }}
                        />
                      </span>
                      <span className="w-10 figure text-xs text-muted-foreground">
                        {Math.round(r.load * 100)}%
                      </span>
                    </span>
                  </TableCell>
                ) : null}
                {show("capacity") ? (
                  <TableCell className="text-right figure text-muted-foreground">
                    {r.unit.capacity.toLocaleString("en-GB")}
                  </TableCell>
                ) : null}
                {show("cost") ? (
                  <TableCell className="text-right figure text-muted-foreground">
                    {r.unit.marginalCost ? r.cost.toFixed(0) : "—"}
                  </TableCell>
                ) : null}
                {show("carbon") ? (
                  <TableCell className="text-right figure text-muted-foreground">
                    {r.unit.carbon}
                  </TableCell>
                ) : null}
                {show("node") ? (
                  <TableCell className="text-muted-foreground capitalize">
                    {r.unit.node}
                  </TableCell>
                ) : null}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${r.unit.name}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setOpen(r.unit.id)}>
                        Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggle(r.unit.id)}>
                        {r.status === "offline"
                          ? "Return to service"
                          : "Take offline"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No unit matches.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="figure">
            {rows.length
              ? `${current * PAGE + 1}–${Math.min(rows.length, (current + 1) * PAGE)} of ${rows.length}`
              : "0 of 0"}
          </span>
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="figure">
              {current + 1} / {pages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </span>
        </div>
      </section>

      <UnitSheet unitId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
