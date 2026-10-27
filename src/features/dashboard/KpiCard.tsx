import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Info } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { AnimatedNumber } from "@/components/animated-number"
import { Badge } from "@/components/ui/badge"

/**
 * The KPI card as every product dashboard draws it: a label, the figure, a trend badge in the
 * corner, and two lines underneath — what the trend means, and what it is measured against.
 *
 * The trend here is against the previous half-hour, so with the clock running every card
 * ticks. `goodWhen` says which way is good: a rising price is not a green arrow.
 */
export function KpiCard({
  label,
  value,
  previous,
  decimals = 0,
  prefix = "",
  unit,
  insight,
  basis,
  goodWhen = "up",
  tone = "normal",
  hero = false,
  hint,
  className = "",
}: {
  label: string
  value: number
  previous?: number
  decimals?: number
  prefix?: string
  unit?: string
  insight: string
  basis: string
  goodWhen?: "up" | "down" | "none"
  tone?: "normal" | "warning"
  hero?: boolean
  /** What the figure means, for someone who does not run a grid. Shown from an info button. */
  hint?: string
  className?: string
}) {
  const change =
    previous !== undefined && Math.abs(previous) > 1e-9
      ? ((value - previous) / Math.abs(previous)) * 100
      : null
  const direction =
    change === null || Math.abs(change) < 0.05
      ? "flat"
      : change > 0
        ? "up"
        : "down"
  const good =
    goodWhen === "none" || direction === "flat"
      ? null
      : (direction === "up") === (goodWhen === "up")

  return (
    <div
      data-figure={label}
      className={`glass flex flex-col gap-3 px-4 py-3.5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1 label">
          {label}
          {hint ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`What is ${label.toLowerCase()}?`}
                    className="-m-1 inline-grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                }
              >
                <Info className="size-3" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent className="max-w-60 text-xs leading-snug normal-case">
                {hint}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </p>
        {change !== null ? (
          <Badge
            variant="outline"
            className={`gap-1 border-border/70 px-1.5 figure text-[0.6875rem] ${
              good === true
                ? "text-fuel-biomass"
                : good === false
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
            aria-label={`${direction === "flat" ? "unchanged" : `${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)} percent`} on the previous half-hour`}
          >
            {direction === "up" ? (
              <ArrowUpRight className="size-3" />
            ) : direction === "down" ? (
              <ArrowDownRight className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {direction === "flat"
              ? "0.0%"
              : `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`}
          </Badge>
        ) : null}
      </div>
      <p className="flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          className={`figure leading-none font-semibold lit ${
            hero ? "text-5xl sm:text-[3.5rem]" : "text-[1.75rem]"
          } ${tone === "warning" ? "text-destructive" : ""}`}
        />
        {unit ? <span className="label">{unit}</span> : null}
      </p>
      <div className="text-xs leading-snug">
        <p className="truncate font-medium">{insight}</p>
        <p className="truncate text-muted-foreground">{basis}</p>
      </div>
    </div>
  )
}
