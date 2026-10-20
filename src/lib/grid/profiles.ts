/**
 * The day, in forty-eight half-hours.
 *
 * Half-hourly because that is the settlement period a real market clears on, and because an
 * hourly curve hides the thing the evening peak is actually about: demand climbs faster than
 * a gas turbine can follow, which is what makes ramp rates matter rather than being a number
 * in a table.
 *
 * The three profiles are generated from shaped functions rather than typed out, so they are
 * smooth, reproducible, and cannot drift from the period count.
 */

export const PERIODS = 48

/** Clock label for a settlement period, 0 → "00:00", 47 → "23:30". */
export function periodLabel(period: number): string {
  const minutes = period * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

const hourOf = (period: number) => (period * 30) / 60

/** A smooth bump centred on `centre` hours, `width` hours wide. */
const bump = (hour: number, centre: number, width: number) =>
  Math.exp(-(((hour - centre) / width) ** 2))

/**
 * Regional demand, MW.
 *
 * An overnight trough, a sharp morning rise as the day starts, a shallow midday plateau and
 * the evening peak that sets the system's worst hour.
 */
export const DEMAND: readonly number[] = Array.from({ length: PERIODS }, (_, p) => {
  const h = hourOf(p)
  const base = 4180
  const morning = 1850 * bump(h, 8.5, 2.6)
  const midday = 900 * bump(h, 13, 3.4)
  const evening = 3050 * bump(h, 18.5, 2.3)
  return Math.round(base + morning + midday + evening)
})

/**
 * Wind availability, 0–1 of installed capacity.
 *
 * A windy night easing through the morning and picking up after dark — the shape that makes
 * the overnight hours awkward, because the cheapest generation arrives when nobody is awake
 * to use it.
 */
export const WIND: readonly number[] = Array.from({ length: PERIODS }, (_, p) => {
  const h = hourOf(p)
  const value = 0.62 + 0.26 * Math.cos((h / 24) * Math.PI * 2) + 0.07 * Math.sin((h / 24) * Math.PI * 6)
  return Math.min(0.94, Math.max(0.08, Number(value.toFixed(4))))
})

/** Solar availability, 0–1. Zero before dawn and after dusk; an autumn day, so a low peak. */
export const SOLAR: readonly number[] = Array.from({ length: PERIODS }, (_, p) => {
  const h = hourOf(p)
  if (h < 7.2 || h > 17.4) return 0
  const noon = (h - 12.3) / 4.4
  return Number(Math.max(0, 0.72 * (1 - noon * noon)).toFixed(4))
})

/** What a unit of a given fuel can actually produce in a period, as a fraction of capacity. */
export function availability(fuel: string, period: number): number {
  if (fuel === "wind") return WIND[period]
  if (fuel === "solar") return SOLAR[period]
  return 1
}
