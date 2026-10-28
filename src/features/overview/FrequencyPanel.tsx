import { useEffect, useRef } from "react"
import { useReducedMotion } from "motion/react"
import { RotateCcw, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useGrid } from "@/features/dashboard/useGrid"
import { FrequencyDial } from "@/features/overview/FrequencyDial"
import {
  TRACE,
  needleTurn,
  traceX,
  traceY,
} from "@/features/overview/frequency-geometry"
import {
  NOMINAL,
  ambient,
  frequencyAt,
  systemInertia,
} from "@/lib/grid/frequency"

/** A trip's thirty seconds replayed four times faster than life, then the re-dispatch back to 50. */
const SPEED = 4
const HOLD_S = 1.6
const EASE_S = 1.8

const SYNCHRONOUS = new Set(["nuclear", "gas", "biomass", "hydro"])

/**
 * System frequency, live. In normal running the needle wanders by tens of millihertz; take a
 * plant out — here, on the diagram, in the scene or on the fleet — and it replays the thirty
 * seconds that follow, solved by the swing equation for the half-hour it happened in: how fast
 * it fell, how far, whether demand had to be disconnected, and how it was held.
 */
export function FrequencyPanel() {
  const { now, offline, toggle, restore, lastTrip } = useGrid()
  const reduced = useReducedMotion()
  const needle = useRef<SVGGElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const path = useRef<SVGPathElement>(null)
  const nadir = useRef<SVGGElement>(null)
  const root = useRef<HTMLElement>(null)

  const t = lastTrip?.transient
  const inertia = systemInertia(now).energy / 1000
  const biggest = now.outputs
    .filter(
      (o) =>
        SYNCHRONOUS.has(o.unit.fuel) &&
        o.mw > 0.5 &&
        !offline.includes(o.unit.id)
    )
    .sort((a, b) => b.mw - a.mw)[0]

  useEffect(() => {
    let raf = 0
    let last = 0
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    if (root.current) io.observe(root.current)
    const write = (f: number, progress: number) => {
      if (needle.current)
        needle.current.style.transform = `rotate(${needleTurn(f)}deg)`
      if (readout.current) readout.current.textContent = f.toFixed(2)
      if (path.current)
        path.current.style.strokeDashoffset = String(1 - progress)
      if (nadir.current && t)
        nadir.current.style.opacity =
          progress * TRACE.seconds >= t.nadirAt ? "1" : "0"
    }
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || ms - last < 33) return
      last = ms
      const calm = reduced ? NOMINAL : ambient(ms / 1000)
      if (!t || !lastTrip) return write(calm, 0)
      const sim = reduced
        ? Number.POSITIVE_INFINITY
        : ((ms - lastTrip.at) / 1000) * SPEED
      if (sim < TRACE.seconds)
        return write(frequencyAt(t, sim), sim / TRACE.seconds)
      const after = reduced ? HOLD_S + EASE_S : (sim - TRACE.seconds) / SPEED
      const k = Math.min(1, Math.max(0, (after - HOLD_S) / EASE_S))
      write(t.settled + (calm - t.settled) * (1 - (1 - k) ** 3), 1)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [t, lastTrip, reduced])

  const d = t?.trace
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${traceX(p.t).toFixed(1)} ${traceY(p.f).toFixed(1)}`
    )
    .join(" ")
  const stats = [
    ["Lost", t ? `${Math.round(t.lost).toLocaleString("en-GB")} MW` : "—"],
    ["RoCoF", t ? `${t.rocof.toFixed(2)} Hz/s` : "—"],
    ["Nadir", t ? `${t.nadir.toFixed(2)} Hz` : "—"],
    [
      "Demand shed",
      t
        ? t.shed
          ? `${Math.round(t.shed).toLocaleString("en-GB")} MW`
          : "none"
        : "—",
    ],
  ] as const

  return (
    <section
      ref={root}
      className="@container panel flex flex-col gap-4 p-4 sm:p-5"
      aria-labelledby="freq-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="freq-title" className="text-sm font-semibold">
            System frequency
          </h2>
          <p className="mt-1 label">
            Inertia {inertia.toFixed(1)} GW·s · swing equation, 30 s after a
            trip
          </p>
        </div>
        <div className="flex gap-2">
          {offline.length ? (
            <Button variant="outline" size="sm" onClick={restore}>
              <RotateCcw aria-hidden="true" />
              Restore all
            </Button>
          ) : null}
          {biggest ? (
            <Button size="sm" onClick={() => toggle(biggest.unit.id)}>
              <Zap aria-hidden="true" />
              Trip {biggest.unit.name}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid items-center gap-5 @2xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[17rem]">
          <FrequencyDial needle={needle} />
          <p className="-mt-1 flex items-baseline justify-center gap-1">
            <span ref={readout} className="figure text-2xl font-medium lit">
              50.00
            </span>
            <span className="label">Hz</span>
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <svg
            viewBox={`0 0 ${TRACE.w} ${TRACE.h}`}
            className="w-full overflow-visible"
            aria-hidden="true"
          >
            <line
              x1={0}
              x2={TRACE.w}
              y1={traceY(50)}
              y2={traceY(50)}
              className="stroke-muted-foreground/40"
              strokeDasharray="2 3"
            />
            <line
              x1={0}
              x2={TRACE.w}
              y1={traceY(48.8)}
              y2={traceY(48.8)}
              className="stroke-destructive/60"
              strokeDasharray="4 3"
            />
            <text
              x={TRACE.w}
              y={traceY(48.8) - 3}
              textAnchor="end"
              className="fill-destructive/80 font-mono text-[9.5px]"
            >
              48.8 · DEMAND DISCONNECTION
            </text>
            {d ? (
              <>
                <path
                  ref={path}
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke="var(--live)"
                  strokeWidth={1.8}
                  strokeDasharray="1"
                  strokeDashoffset="1"
                />
                <g
                  ref={nadir}
                  style={{ opacity: 0, transition: "opacity 300ms" }}
                >
                  <circle
                    cx={traceX(t!.nadirAt)}
                    cy={traceY(t!.nadir)}
                    r={3.2}
                    fill="var(--live)"
                  />
                  <text
                    x={traceX(t!.nadirAt) + 6}
                    y={traceY(t!.nadir) + 3}
                    className="fill-foreground font-mono text-[9.5px]"
                  >
                    {t!.nadir.toFixed(2)} Hz at {t!.nadirAt.toFixed(1)} s
                  </text>
                </g>
              </>
            ) : (
              <text
                x={TRACE.w / 2}
                y={traceY(49.4)}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                Trip a plant to see the next thirty seconds
              </text>
            )}
          </svg>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="label">{label}</dt>
                <dd
                  className={`figure text-sm ${label === "Demand shed" && t?.shed ? "text-destructive" : ""}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {lastTrip && t
          ? `${lastTrip.unit.name} tripped: ${Math.round(t.lost)} megawatts lost, frequency fell to ${t.nadir.toFixed(2)} hertz${t.shed ? `, ${t.blocks} block${t.blocks > 1 ? "s" : ""} of demand disconnected` : ""}.`
          : ""}
      </p>
    </section>
  )
}
