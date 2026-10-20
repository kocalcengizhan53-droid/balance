/**
 * The fleet.
 *
 * A fiction, like the building in the other piece in this portfolio — but a fiction with
 * consistent physics. Capacities, ramp rates and heat-rate-derived costs are in the range a
 * real plant of each type sits in, because the point of the dashboard is that the arithmetic
 * holds, and arithmetic over invented numbers that are the wrong order of magnitude holds
 * nothing.
 *
 * Nothing downstream may state a figure that is not computed from this array and the profiles
 * beside it. That is the one rule, and `dispatch.test.ts` enforces the part of it that can be
 * enforced: generation equals demand in every settlement period.
 */

export type Fuel =
  | "nuclear"
  | "gas"
  | "wind"
  | "solar"
  | "hydro"
  | "biomass"
  | "battery"
  | "import"

export type Unit = {
  readonly id: string
  readonly name: string
  readonly fuel: Fuel
  /** Maximum output, MW. */
  readonly capacity: number
  /**
   * Minimum stable generation, MW. A thermal plant cannot be turned down below this and stay
   * synchronised; below it the unit is off. Zero for anything that can be modulated freely.
   */
  readonly minStable: number
  /** Short-run marginal cost, £/MWh. Sets the merit order and, at the margin, the price. */
  readonly marginalCost: number
  /** Direct emissions, gCO₂ per kWh generated. */
  readonly carbon: number
  /** How fast output can change, MW per minute. */
  readonly rampRate: number
  /** The node it connects to. Flows are drawn along these. */
  readonly node: string
}

export const UNITS: readonly Unit[] = [
  {
    id: "hartmoor",
    name: "Hartmoor",
    fuel: "nuclear",
    capacity: 1180,
    minStable: 1180,
    marginalCost: 9,
    carbon: 0,
    rampRate: 0,
    node: "west",
  },
  {
    id: "calder-a",
    name: "Calder A",
    fuel: "gas",
    capacity: 910,
    minStable: 340,
    marginalCost: 62,
    carbon: 352,
    rampRate: 22,
    node: "central",
  },
  {
    id: "calder-b",
    name: "Calder B",
    fuel: "gas",
    capacity: 910,
    minStable: 340,
    marginalCost: 64,
    carbon: 358,
    rampRate: 22,
    node: "central",
  },
  {
    id: "eastmarsh",
    name: "Eastmarsh",
    fuel: "gas",
    capacity: 620,
    minStable: 240,
    marginalCost: 71,
    carbon: 394,
    rampRate: 18,
    node: "east",
  },
  {
    id: "lowfield",
    name: "Lowfield",
    fuel: "gas",
    capacity: 410,
    minStable: 160,
    marginalCost: 88,
    carbon: 452,
    rampRate: 26,
    node: "central",
  },
  {
    id: "brae",
    name: "Brae",
    fuel: "wind",
    capacity: 1420,
    minStable: 0,
    marginalCost: 0,
    carbon: 0,
    rampRate: 400,
    node: "north",
  },
  {
    id: "dunmoor",
    name: "Dunmoor",
    fuel: "wind",
    capacity: 880,
    minStable: 0,
    marginalCost: 0,
    carbon: 0,
    rampRate: 400,
    node: "north",
  },
  {
    id: "fenley",
    name: "Fenley",
    fuel: "solar",
    capacity: 640,
    minStable: 0,
    marginalCost: 0,
    carbon: 0,
    rampRate: 400,
    node: "east",
  },
  {
    id: "glenock",
    name: "Glenock",
    fuel: "hydro",
    capacity: 300,
    minStable: 0,
    marginalCost: 36,
    carbon: 0,
    rampRate: 150,
    node: "north",
  },
  {
    id: "thornby",
    name: "Thornby",
    fuel: "biomass",
    capacity: 420,
    minStable: 180,
    marginalCost: 79,
    carbon: 121,
    rampRate: 12,
    node: "central",
  },
  {
    id: "keld",
    name: "Keld",
    fuel: "battery",
    capacity: 220,
    minStable: 0,
    marginalCost: 104,
    carbon: 0,
    rampRate: 220,
    node: "central",
  },
]

/**
 * The interconnector, treated as a dispatchable unit at the end of the merit order and as a
 * sink when the system is long. Its carbon is the neighbouring system's average, not ours —
 * importing does not make the emissions disappear, and a dashboard that pretends otherwise is
 * the reason "zero carbon" claims are not believed.
 */
export const INTERCONNECTOR = {
  id: "strait",
  name: "Strait link",
  capacity: 1000,
  importCost: 96,
  /** Paid to export, £/MWh. Lower than the import price: the spread is the link's business. */
  exportPrice: 41,
  carbon: 218,
  node: "east",
} as const

/** The four grid nodes. Units connect to one; every node feeds the single busbar. */
export const NODES = {
  north: { name: "North" },
  west: { name: "West" },
  central: { name: "Central" },
  east: { name: "East" },
} as const

export type NodeId = keyof typeof NODES
