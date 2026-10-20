import type { Fuel } from "@/lib/grid/units"

/**
 * The order fuels are stacked in, bottom to top.
 *
 * It is also the order the colour palette was validated against: in a stacked chart the pairs
 * that have to be distinguishable are the neighbours, so changing this order invalidates the
 * palette and `fuel.test.ts` will say so.
 */
export const FUEL_ORDER = [
  "nuclear",
  "wind",
  "solar",
  "hydro",
  "biomass",
  "gas",
  "battery",
  "import",
] as const satisfies readonly (Fuel | "import")[]

export type Series = (typeof FUEL_ORDER)[number]

export const FUEL_LABEL: Record<Series, string> = {
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  gas: "Gas",
  battery: "Storage",
  import: "Import",
}

/** Tailwind colour utility fragment, e.g. `text-fuel-gas`. Defined in index.css for both themes. */
export const fuelVar = (fuel: Series) => `var(--fuel-${fuel})`
