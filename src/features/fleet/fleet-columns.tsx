import { SortHeader } from "@/features/fleet/SortHeader"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type UnitStatus } from "@/lib/grid/analysis"
import { type UnitOutput } from "@/lib/grid/dispatch"
import type { Unit } from "@/lib/grid/units"
import { FUEL_LABEL, fuelVar, type Series } from "@/lib/viz/fuel"

export type Row = {
  unit: Unit
  out: UnitOutput
  status: UnitStatus
  load: number
  cost: number
}

const STATUS_TONE: Record<UnitStatus, string> = {
  running: "text-fuel-biomass border-fuel-biomass/40",
  constrained: "text-live border-live/40",
  idle: "text-muted-foreground",
  offline: "text-destructive border-destructive/40",
}

const num = (v: number) => Math.round(v).toLocaleString("en-GB")

/**
 * The fleet table's columns: what each shows, how it sorts and filters. What a row can do — open
 * its drawer, take its unit out — comes in from the page, which owns the state.
 */
export function fleetColumns(deps: {
  offline: readonly string[]
  toggle: (id: string) => void
  openUnit: (id: string) => void
}): ColumnDef<Row>[] {
  return [
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
            <DropdownMenuItem
              onClick={() => deps.openUnit(row.original.unit.id)}
            >
              Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => deps.toggle(row.original.unit.id)}>
              {row.original.status === "offline"
                ? "Return to service"
                : "Take deps.offline"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
