import { fuelVar, type Series } from "@/lib/viz/fuel"
import type { Period } from "@/lib/grid/dispatch"
import { INTERCONNECTOR, NODES, UNITS, type NodeId } from "@/lib/grid/units"

/**
 * The system as a single-line diagram: every unit on its own row, each row feeding its node,
 * every node feeding one busbar, and demand drawn off the far side.
 *
 * It was drawn as a map first — units scattered at invented coordinates, lines radiating to
 * their nodes. It looked like a grid and was unreadable: labels sat on their own lines, NORTH
 * printed through Glenock, CENTRAL through the demand figure the whole diagram is built
 * around, and the two left-hand units ran off the edge of the canvas. Nothing about a plant's
 * position on an imaginary coastline is information. A row per unit is, and it cannot collide
 * with itself.
 *
 * Two channels, two questions. Line width is megawatts — how much. Dash speed is the fraction
 * of what that unit could be giving — how hard it is working. A nuclear station flat out and
 * a battery flat out move at the same speed and are nothing like the same width.
 */

const W = 160
const H = 58
const TOP = 6
const ROW = 4.2

const NAME_X = 30
const MW_X = 41
const DOT_X = 47
const NODE_X = 86
const BUS_X = 120
const DEMAND_X = 127

/** Units grouped under their node, in node order: the row list and the node order are one thing. */
const GROUPS = (Object.keys(NODES) as NodeId[]).map((id) => ({
  id,
  name: NODES[id].name,
  units: UNITS.filter((u) => u.node === id),
}))

const ROWS = GROUPS.flatMap((g) => g.units)
const rowY = (index: number) => TOP + index * ROW
const LINK_ROW = ROWS.length
const LAST_Y = rowY(LINK_ROW)
const MID_Y = (TOP + LAST_Y) / 2

/** One linear megawatt scale for the whole diagram, so a unit and a node are comparable. */
const width = (mw: number) => 0.3 + (Math.min(mw, 3000) / 3000) * 3

/** Seconds for one dash to travel: fast when the thing is flat out, still when it is idle. */
const flowSpeed = (mw: number, capacity: number) => {
  const load = capacity > 0 ? Math.min(1, mw / capacity) : 0
  return load < 0.02 ? 0 : 3.2 - load * 2.4
}

/** A lead from one column to the next, flat at both ends so it leaves and arrives horizontally. */
const lead = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = (x2 - x1) * 0.42
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

function Flow({
  d,
  mw,
  capacity,
  colour,
}: {
  d: string
  mw: number
  capacity: number
  colour: string
}) {
  const seconds = flowSpeed(mw, capacity)
  return (
    <g fill="none">
      <path d={d} className="stroke-border" strokeWidth={0.28} />
      {mw > 0.5 ? (
        <path
          d={d}
          stroke={colour}
          strokeWidth={width(mw)}
          strokeLinecap="round"
          /* 1.6 + 2.4 = 4, the distance one `flow` cycle travels, so the dashes loop seamlessly. */
          strokeDasharray="1.6 2.4"
          className={seconds > 0 ? "flow" : undefined}
          style={
            seconds > 0
              ? { animationDuration: `${seconds.toFixed(2)}s` }
              : undefined
          }
        />
      ) : null}
    </g>
  )
}

export function Schematic({
  now,
  offline,
  onToggle,
}: {
  now: Period
  offline: readonly string[]
  onToggle: (id: string) => void
}) {
  const groups = GROUPS.map((group) => {
    const rows = group.units.map((unit) => ({
      unit,
      out: now.outputs.find((o) => o.unit.id === unit.id)!,
      y: rowY(ROWS.indexOf(unit)),
    }))
    return {
      ...group,
      rows,
      mw: rows.reduce((s, r) => s + r.out.mw, 0),
      capacity: group.units.reduce((s, u) => s + u.capacity, 0),
      y: rows.reduce((s, r) => s + r.y, 0) / rows.length,
    }
  })

  const importing = now.interconnector > 0
  const linkMw = Math.abs(now.interconnector)
  const linkY = rowY(LINK_ROW)

  return (
    <figure className="rounded-lg border border-border/70 bg-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Where it is coming from
        </h2>
        <p className="text-xs text-muted-foreground">
          Line width is megawatts, dash speed is how hard the unit is working.
          Press a row to take it offline.{" "}
          {/* Narrow enough and the drawing is clipped by its own scroller, with nothing on
              screen to say so. */}
          <span className="lg:hidden">
            Scroll it sideways to reach the busbar.
          </span>
        </p>
      </figcaption>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto block w-full max-w-[72rem] min-w-[54rem]"
          role="img"
          aria-label={`System single-line diagram. ${groups
            .map((g) => `${g.name} ${Math.round(g.mw)} megawatts`)
            .join(
              ", "
            )}. The link is ${importing ? "importing" : "exporting"} ${Math.round(linkMw)} megawatts. Demand ${Math.round(now.demand)} megawatts.`}
        >
          {/* Leads first, marks over them: a line never prints across a figure. */}
          {groups.map((group) => (
            <g key={`leads-${group.id}`}>
              {group.rows.map(({ unit, out, y }) => (
                <Flow
                  key={unit.id}
                  d={lead(DOT_X, y, NODE_X - 2.2, group.y)}
                  mw={out.mw}
                  capacity={unit.capacity}
                  colour={fuelVar(unit.fuel as Series)}
                />
              ))}
              <Flow
                d={lead(NODE_X + 2.2, group.y, BUS_X, group.y)}
                mw={group.mw}
                capacity={group.capacity}
                colour="var(--color-foreground)"
              />
            </g>
          ))}

          <Flow
            d={
              importing
                ? lead(DOT_X, linkY, BUS_X, linkY)
                : lead(BUS_X, linkY, DOT_X, linkY)
            }
            mw={linkMw}
            capacity={INTERCONNECTOR.capacity}
            colour={fuelVar("import")}
          />

          {/* Demand, drawn off the far side of the bar. */}
          <g>
            <path
              d={`M ${BUS_X} ${MID_Y} L ${DEMAND_X - 2} ${MID_Y}`}
              fill="none"
              className="stroke-foreground"
              strokeWidth={3.6}
              strokeLinecap="butt"
            />
            <path
              d={`M ${DEMAND_X - 2.4} ${MID_Y - 1.8} L ${DEMAND_X + 0.6} ${MID_Y} L ${DEMAND_X - 2.4} ${MID_Y + 1.8} Z`}
              className="fill-foreground"
            />
            <text
              x={DEMAND_X + 2.4}
              y={MID_Y - 0.2}
              className="fill-foreground text-[3.2px] font-semibold tabular-nums"
            >
              {(now.demand / 1000).toFixed(2)}
            </text>
            <text
              x={DEMAND_X + 2.4}
              y={MID_Y + 3.4}
              className="fill-muted-foreground text-[1.7px] tracking-wide uppercase"
            >
              GW demand
            </text>
          </g>

          {/* The busbar. Everything in the region meets on this bar and leaves it once. */}
          <rect
            x={BUS_X - 0.7}
            y={TOP - 3.4}
            width={1.4}
            height={LAST_Y - TOP + 6.8}
            rx={0.7}
            className="fill-foreground"
          />

          {groups.map((group) => (
            <g key={`node-${group.id}`}>
              <circle
                cx={NODE_X}
                cy={group.y}
                r={2.2}
                className="fill-card stroke-foreground"
                strokeWidth={0.45}
              />
              <text
                x={NODE_X}
                y={group.y - 3.4}
                textAnchor="middle"
                className="fill-foreground text-[1.8px] font-medium tracking-wide uppercase"
              >
                {group.name}
              </text>
              {/*
              The node total rides above its own lead, clear of the stroke rather than at a
              fixed offset: Central carries 2,650 MW, so its lead is three units thick and a
              fixed offset put the figure inside the line.
            */}
              <text
                x={NODE_X + 5}
                y={group.y - 1.4 - width(group.mw) / 2}
                className="fill-muted-foreground text-[1.7px] tabular-nums"
              >
                {Math.round(group.mw).toLocaleString()} MW
              </text>
            </g>
          ))}

          {groups.flatMap((group) =>
            group.rows.map(({ unit, out, y }) => {
              const r = 1 + Math.sqrt(unit.capacity) / 30
              const load = out.available > 0 ? out.mw / out.available : 0
              const isOffline = offline.includes(unit.id)
              return (
                <g
                  key={unit.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isOffline}
                  aria-label={`${unit.name}, ${Math.round(out.mw)} of ${unit.capacity} megawatts${isOffline ? ", offline" : ""}`}
                  onClick={() => onToggle(unit.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onToggle(unit.id)
                    }
                  }}
                  className="group cursor-pointer outline-none"
                >
                  {/* The whole row is the target — name, figure and mark — not a 3px dot. */}
                  <rect
                    x={0}
                    y={y - ROW / 2}
                    width={DOT_X + 3}
                    height={ROW}
                    rx={0.8}
                    strokeWidth={0.35}
                    className="fill-transparent stroke-transparent group-hover:fill-muted group-focus-visible:fill-muted group-focus-visible:stroke-foreground"
                  />
                  <text
                    x={NAME_X}
                    y={y + 0.7}
                    textAnchor="end"
                    className={
                      isOffline
                        ? "fill-muted-foreground text-[2px] line-through"
                        : "fill-foreground text-[2px]"
                    }
                  >
                    {unit.name}
                  </text>
                  <text
                    x={MW_X}
                    y={y + 0.7}
                    textAnchor="end"
                    className="fill-muted-foreground text-[2px] tabular-nums"
                  >
                    {Math.round(out.mw).toLocaleString()}
                  </text>
                  <circle
                    cx={DOT_X}
                    cy={y}
                    r={r}
                    fill={fuelVar(unit.fuel as Series)}
                    opacity={isOffline ? 0.15 : 0.25 + load * 0.75}
                    stroke={fuelVar(unit.fuel as Series)}
                    strokeOpacity={isOffline ? 0.35 : 1}
                    strokeWidth={0.4}
                  />
                  {isOffline ? (
                    <g
                      className="stroke-destructive"
                      strokeWidth={0.5}
                      strokeLinecap="round"
                    >
                      <line
                        x1={DOT_X - r}
                        y1={y - r}
                        x2={DOT_X + r}
                        y2={y + r}
                      />
                      <line
                        x1={DOT_X - r}
                        y1={y + r}
                        x2={DOT_X + r}
                        y2={y - r}
                      />
                    </g>
                  ) : null}
                </g>
              )
            })
          )}

          {/* The link gets the same row treatment, with a box rather than a dot: it is a way out
            of the region, not a machine in it. */}
          <g>
            <text
              x={NAME_X}
              y={linkY + 0.7}
              textAnchor="end"
              className="fill-foreground text-[2px]"
            >
              {INTERCONNECTOR.name}
            </text>
            <text
              x={MW_X}
              y={linkY + 0.7}
              textAnchor="end"
              className="fill-muted-foreground text-[2px] tabular-nums"
            >
              {Math.round(linkMw).toLocaleString()}
            </text>
            <rect
              x={DOT_X - 2}
              y={linkY - 1.5}
              width={4}
              height={3}
              rx={0.5}
              className="fill-card stroke-foreground"
              strokeWidth={0.35}
            />
            <text
              x={DOT_X}
              y={linkY + 0.8}
              textAnchor="middle"
              className="fill-foreground text-[2.2px]"
            >
              {importing ? "→" : "←"}
            </text>
            <text
              x={DOT_X + 4}
              y={linkY + 1.6 + width(linkMw) / 2}
              className="fill-muted-foreground text-[1.7px] tracking-wide uppercase"
            >
              {importing ? "importing" : "exporting"}
            </text>
          </g>
        </svg>
      </div>
    </figure>
  )
}
