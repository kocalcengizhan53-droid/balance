/**
 * The frequency as a control room shows it: a dial from 48 to 52 Hz with the operating band,
 * the statutory band and the demand-disconnection zone marked, and a needle. Presentational:
 * the panel moves the needle by writing to the ref, so nothing re-renders at frame rate.
 */

import { CX, CY, HIGH, LOW, R } from "@/features/overview/frequency-geometry"

const angle = (f: number) =>
  Math.PI * (1 - (Math.min(HIGH, Math.max(LOW, f)) - LOW) / (HIGH - LOW))
const at = (f: number, r = R) =>
  [CX + r * Math.cos(angle(f)), CY - r * Math.sin(angle(f))] as const

function arc(from: number, to: number, r = R) {
  const [x1, y1] = at(from, r)
  const [x2, y2] = at(to, r)
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

const TICKS = Array.from({ length: 17 }, (_, i) => LOW + i * 0.25)

export function FrequencyDial({ needle }: { needle: React.Ref<SVGGElement> }) {
  return (
    <svg viewBox="0 0 240 132" className="w-full" aria-hidden="true">
      <path
        d={arc(LOW, HIGH)}
        fill="none"
        className="stroke-muted-foreground/20"
        strokeWidth={10}
      />
      <path
        d={arc(LOW, 48.8)}
        fill="none"
        className="stroke-destructive/70"
        strokeWidth={10}
      />
      <path
        d={arc(49.5, 50.5)}
        fill="none"
        className="stroke-foreground/25"
        strokeWidth={10}
      />
      <path
        d={arc(49.8, 50.2)}
        fill="none"
        stroke="var(--live)"
        strokeWidth={10}
      />
      {TICKS.map((f) => {
        const major = f % 1 === 0
        const [x1, y1] = at(f, R - 9)
        const [x2, y2] = at(f, R - (major ? 20 : 14))
        return (
          <line
            key={f}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="stroke-muted-foreground"
            strokeWidth={major ? 1.4 : 0.8}
          />
        )
      })}
      {[48, 49, 50, 51, 52].map((f) => {
        const [x, y] = at(f, R - 32)
        return (
          <text
            key={f}
            x={x}
            y={y + 3}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            {f}
          </text>
        )
      })}
      {(() => {
        const [x, y] = at(48.4, R - 30)
        return (
          <text
            x={x}
            y={y}
            textAnchor="middle"
            className="fill-destructive font-mono text-[9px] uppercase"
          >
            LFDD
          </text>
        )
      })()}
      <g
        ref={needle}
        style={{ transformOrigin: `${CX}px ${CY}px`, transformBox: "view-box" }}
      >
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - R + 14}
          className="stroke-foreground"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY - R + 14} r={2.6} fill="var(--live)" />
      </g>
      <circle
        cx={CX}
        cy={CY}
        r={6}
        className="fill-card stroke-foreground"
        strokeWidth={1.6}
      />
    </svg>
  )
}
