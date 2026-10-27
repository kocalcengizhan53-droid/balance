import { useState } from "react"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
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
import { costWithCarbon, type UnitOutput } from "@/lib/grid/dispatch"
import { periodLabel } from "@/lib/grid/profiles"
import type { Unit } from "@/lib/grid/units"
import { FUEL_LABEL, FUEL_ORDER, fuelVar, type Series } from "@/lib/viz/fuel"

/**
 * The fleet as a product table: tabs over it, a search box, a fuel filter, a column menu,
 * row selection with a bulk action, sortable headers, status badges, a drawer per row, and a
 * pager — on TanStack Table, so sorting, filtering, paging, selection and visibility are one
 * model rather than seven pieces of state. Every figure in it is the solver's, re-read as the
 * clock runs.
 */

type Row = {
  unit: Unit
  out: UnitOutput
  status: UnitStatus
  load: number
  cost: number
}

const PAGE = 8

const STATUS_TONE: Record<UnitStatus, string> = {
  running: "text-fuel-biomass border-fuel-biomass/40",
  constrained: "text-live border-live/40",
  idle: "text-muted-foreground",
  offline: "text-destructive border-destructive/40",
}

/** A header that sorts its column, and says which way it is sorted to a screen reader. */
function SortHeader({ column, label }: { column: Column<Row>; label: string }) {
  const dir = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        className={`size-3 ${dir ? "text-foreground" : ""}`}
        aria-hidden="true"
      />
      <span className="sr-only">
        {dir === "asc"
          ? ", sorted ascending"
          : dir === "desc"
            ? ", sorted descending"
            : ", sort"}
      </span>
    </button>
  )
}

const num = (v: number) => Math.round(v).toLocaleString("en-GB")

export function FleetPage() {
  // TanStack Table v8 keeps its own mutable state inside the table object; the compiler's
  // memoisation would hide its updates, so this component opts out.
  "use no memo"
  const { units, now, period, offline, toggle, restore, scenario } = useGrid()
  const [tab, setTab] = useState<"all" | UnitStatus>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "output", desc: true },
  ])
  const [filters, setFilters] = useState<ColumnFiltersState>([])
  const [query, setQuery] = useState("")
  const [visibility, setVisibility] = useState<VisibilityState>({})
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE })
  const [open, setOpen] = useState<string | null>(null)

  const all: Row[] = units.map((unit) => {
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
  const counts: Record<string, number> = { all: all.length }
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1
  const data = tab === "all" ? all : all.filter((r) => r.status === tab)

  const columns: ColumnDef<Row>[] = [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(on) => table.toggleAllPageRowsSelected(!!on)}
          aria-label="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(on) => row.toggleSelected(!!on)}
          aria-label={`Select ${row.original.unit.name}`}
        />
      ),
    },
    {
      id: "name",
      accessorFn: (r) => r.unit.name,
      enableHiding: false,
      filterFn: (row, _id, value: string) =>
        row.original.unit.name
          .toLowerCase()
          .includes(value.trim().toLowerCase()),
      header: ({ column }) => <SortHeader column={column} label="Unit" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{
              backgroundColor: fuelVar(row.original.unit.fuel as Series),
            }}
            aria-hidden="true"
          />
          <span className="font-medium">{row.original.unit.name}</span>
          <span className="text-xs text-muted-foreground">
            {FUEL_LABEL[row.original.unit.fuel as Series]}
          </span>
        </span>
      ),
    },
    {
      id: "fuel",
      accessorFn: (r) => r.unit.fuel,
      enableHiding: false,
      filterFn: "equalsString",
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <SortHeader column={column} label="Status" />,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`capitalize ${STATUS_TONE[row.original.status]}`}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "output",
      accessorFn: (r) => r.out.mw,
      meta: { numeric: true, label: "Output" },
      header: ({ column }) => <SortHeader column={column} label="Output" />,
      cell: ({ row }) => num(row.original.out.mw),
    },
    {
      id: "load",
      accessorKey: "load",
      meta: { numeric: true, label: "Load" },
      header: ({ column }) => <SortHeader column={column} label="Load" />,
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.round(row.original.load * 100)}%`,
                backgroundColor: fuelVar(row.original.unit.fuel as Series),
              }}
            />
          </span>
          <span className="w-10 figure text-xs text-muted-foreground">
            {Math.round(row.original.load * 100)}%
          </span>
        </span>
      ),
    },
    {
      id: "capacity",
      accessorFn: (r) => r.unit.capacity,
      meta: { numeric: true, muted: true, label: "Capacity" },
      header: ({ column }) => <SortHeader column={column} label="Capacity" />,
      cell: ({ row }) => num(row.original.unit.capacity),
    },
    {
      id: "cost",
      accessorKey: "cost",
      meta: { numeric: true, muted: true, label: "£/MWh" },
      header: ({ column }) => <SortHeader column={column} label="£/MWh" />,
      cell: ({ row }) =>
        row.original.unit.marginalCost ? row.original.cost.toFixed(0) : "—",
    },
    {
      id: "carbon",
      accessorFn: (r) => r.unit.carbon,
      meta: { numeric: true, muted: true, label: "gCO₂/kWh" },
      header: ({ column }) => <SortHeader column={column} label="gCO₂/kWh" />,
      cell: ({ row }) => row.original.unit.carbon,
    },
    {
      id: "node",
      accessorFn: (r) => r.unit.node,
      meta: { muted: true, label: "Node" },
      header: ({ column }) => <SortHeader column={column} label="Node" />,
      cell: ({ row }) => (
        <span className="capitalize">{row.original.unit.node}</span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.unit.name}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpen(row.original.unit.id)}>
              Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toggle(row.original.unit.id)}>
              {row.original.status === "offline"
                ? "Return to service"
                : "Take offline"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out of the compiler above
  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => r.unit.id,
    state: {
      sorting,
      columnFilters: [
        ...filters,
        ...(query ? [{ id: "name", value: query }] : []),
      ],
      columnVisibility: { ...visibility, fuel: false },
      rowSelection: selection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    onPaginationChange: setPagination,
    sortDescFirst: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const firstPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }))
  const fuel =
    (filters.find((f) => f.id === "fuel")?.value as string | undefined) ?? "all"
  const selected = Object.keys(selection).filter((id) => selection[id])
  const shown = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const metaOf = (c: Column<Row>) =>
    (c.columnDef.meta ?? {}) as {
      numeric?: boolean
      muted?: boolean
      label?: string
    }

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
              firstPage()
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
                  firstPage()
                }}
                placeholder="Find a unit"
                aria-label="Find a unit"
                className="h-8 w-44 pl-8"
              />
            </label>
            <Select
              value={fuel}
              onValueChange={(v) => {
                const value = String(v ?? "all")
                setFilters(value === "all" ? [] : [{ id: "fuel", value }])
                firstPage()
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
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.id}
                        checked={c.getIsVisible()}
                        onCheckedChange={(on) => c.toggleVisibility(!!on)}
                      >
                        {metaOf(c).label ??
                          c.id[0].toUpperCase() + c.id.slice(1)}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selected.length ? (
          <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <span className="figure">{selected.length} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                for (const id of selected) if (!offline.includes(id)) toggle(id)
                setSelection({})
              }}
            >
              Take offline
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                for (const id of selected) if (offline.includes(id)) toggle(id)
                setSelection({})
              }}
            >
              Return to service
            </Button>
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setSelection({})}
            >
              Clear
            </button>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="text-xs">
                {group.headers.map((header) => {
                  const meta = metaOf(header.column)
                  const dir = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        dir === "asc"
                          ? "ascending"
                          : dir === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={
                        header.id === "select" || header.id === "actions"
                          ? "w-10"
                          : meta.numeric
                            ? "text-right"
                            : ""
                      }
                    >
                      {header.isPlaceholder || !header.column.columnDef.header
                        ? null
                        : typeof header.column.columnDef.header === "function"
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={`cursor-pointer ${row.original.status === "offline" ? "opacity-60" : ""}`}
                onClick={() => setOpen(row.original.unit.id)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = metaOf(cell.column)
                  const stop =
                    cell.column.id === "select" || cell.column.id === "actions"
                  const render = cell.column.columnDef.cell
                  return (
                    <TableCell
                      key={cell.id}
                      onClick={stop ? (e) => e.stopPropagation() : undefined}
                      className={[
                        meta.numeric ? "text-right figure" : "",
                        meta.muted ? "text-muted-foreground" : "",
                      ].join(" ")}
                    >
                      {typeof render === "function"
                        ? render(cell.getContext())
                        : null}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
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
            {shown
              ? `${pageIndex * PAGE + 1}–${Math.min(shown, (pageIndex + 1) * PAGE)} of ${shown}`
              : "0 of 0"}
          </span>
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="figure">
              {pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
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
