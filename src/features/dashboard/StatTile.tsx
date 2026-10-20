/**
 * A stat tile: label, value, unit, and an optional note.
 *
 * Proportional figures, not tabular — a tabular `1` is as wide as a `0`, which makes a
 * display-size number look gappy. Tabular belongs in the columns of the unit table, where
 * digits have to line up.
 */
export function StatTile({
  label,
  value,
  unit,
  note,
  tone = "normal",
}: {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: "normal" | "warning"
}) {
  return (
    <div
      data-figure={label}
      className="rounded-lg border border-border/70 bg-card px-4 py-3"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={`text-2xl leading-none font-semibold tracking-tight ${
            tone === "warning" ? "text-destructive" : ""
          }`}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}
