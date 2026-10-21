import { AnimatedNumber } from "@/components/animated-number"

/**
 * A stat tile: label, a figure that rolls to its value, a unit, and an optional note.
 *
 * The figure is set in the mono instrument face so the digits line up as the clock runs, and
 * it animates rather than jumps so a change reads as a change and not as a flicker. A hero
 * tile is the same thing larger, for the one number the page is about.
 */
export function StatTile({
  label,
  value,
  decimals = 0,
  prefix = "",
  unit,
  note,
  tone = "normal",
  hero = false,
  className = "",
}: {
  label: string
  value: number
  decimals?: number
  prefix?: string
  unit?: string
  note?: string
  tone?: "normal" | "warning"
  hero?: boolean
  className?: string
}) {
  return (
    <div
      data-figure={label}
      className={`glass flex flex-col justify-between px-4 py-3.5 ${className}`}
    >
      <p className="label">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          className={`figure leading-none font-semibold lit ${
            hero ? "text-5xl sm:text-6xl" : "text-[1.75rem]"
          } ${tone === "warning" ? "text-destructive" : ""}`}
        />
        {unit ? <span className="label">{unit}</span> : null}
      </p>
      {note ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}
