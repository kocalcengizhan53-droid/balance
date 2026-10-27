import { DEMAND, PERIODS, availability } from "@/lib/grid/profiles"
import { INTERCONNECTOR, UNITS, type Unit } from "@/lib/grid/units"

/**
 * The solver.
 *
 * Everything on screen comes from here. For each half-hour it meets demand from the cheapest
 * available plant upwards, inside the limits a real unit has — how fast it can change output,
 * and how far down it can be turned without tripping off — and settles the remainder on the
 * interconnector. What it will not do is lose track of a megawatt: generation plus imports
 * equals demand plus exports plus curtailment in every period, and the test asserts it to a
 * tenth of a megawatt.
 *
 * Simplifications, stated because an unstated simplification is a lie:
 *
 * - Unit commitment is greedy, not optimal. A thermal unit starts if the residual demand when
 *   its turn comes is at least its minimum stable generation, and otherwise stays off. A real
 *   market solves this as an integer programme over the whole day and will sometimes commit a
 *   unit at a loss now to avoid a start-up later.
 * - The network is a single copper plate. Nodes exist for the schematic; no flow is limited
 *   between them.
 * - The battery is modelled as expensive peaking capacity, not as storage with a state of
 *   charge, so it has no round-trip losses and never runs empty.
 */

export type UnitOutput = {
  readonly unit: Unit
  /** MW delivered in this period. */
  readonly mw: number
  /** MW the unit could have delivered — capacity, less the weather for wind and solar. */
  readonly available: number
}

export type Period = {
  readonly period: number
  readonly demand: number
  readonly outputs: readonly UnitOutput[]
  /** Positive is import, negative is export, MW. */
  readonly interconnector: number
  /** Renewable output spilled because the system was already long, MW. */
  readonly curtailed: number
  /** System marginal price, £/MWh — what the last megawatt cost. */
  readonly price: number
  /** Emissions of everything serving demand, gCO₂ per kWh. */
  readonly carbonIntensity: number
  /** Which unit set the price. */
  readonly marginalUnit: string
  /**
   * Demand the system could not meet, MW. Zero on a working day; the number a control room
   * exists to keep at zero, so it is carried rather than assumed.
   */
  readonly unserved: number
}

export type Solution = {
  readonly periods: readonly Period[]
  readonly offline: readonly string[]
  readonly scenario: Scenario
  /** The fleet as solved: the units, with any operator's edits applied. */
  readonly fleet: readonly Unit[]
}

/**
 * The levers a visitor can pull. Each one changes an input to the same solver, never a result:
 * a carbon price is added to every unit's cost in proportion to what it emits, so the merit
 * order re-sorts itself; demand and wind are scaled before dispatch, not after.
 */
export type Scenario = {
  /** £ per tonne of CO₂, charged on every megawatt-hour in proportion to its emissions. */
  readonly carbonPrice: number
  /** Multiplier on regional demand — a heatwave is 1.15, a quiet Sunday 0.9. */
  readonly demandScale: number
  /** Multiplier on wind availability — a calm day is 0.3, a storm front 1.3 (capped at 1). */
  readonly windScale: number
}

export const BASELINE: Scenario = {
  carbonPrice: 0,
  demandScale: 1,
  windScale: 1,
}

/**
 * A unit's short-run cost under a carbon price. `carbon` is gCO₂/kWh, which is kg/MWh, so a
 * tonne price per MWh is carbon / 1000 × price. Gas at 352 g and £50/t gains £17.60; nuclear
 * and the renewables gain nothing, which is the whole point of the instrument.
 */
export const costWithCarbon = (
  cost: number,
  carbon: number,
  carbonPrice: number
) => cost + (carbon / 1000) * carbonPrice

const HOURS_PER_PERIOD = 0.5
const RAMP_PER_PERIOD = (unit: Unit) => unit.rampRate * 60 * HOURS_PER_PERIOD

/**
 * Cheapest first, with the import sitting at its own price rather than after everything.
 *
 * Handled outside the merit order, the link was called last and the battery at £104 ran while
 * the neighbour was offering £96 — the system was buying the expensive megawatt and leaving
 * the cheap one on the table, which is the one thing a merit order exists to prevent.
 */
const LINK = "__link__"
type Merit = readonly { id: string; cost: number; unit?: Unit }[]

/** Built per solve, because the carbon price changes who is cheap. */
const meritOrder = (scenario: Scenario, fleet: readonly Unit[]): Merit =>
  [
    ...fleet.map((unit) => ({
      id: unit.id,
      cost: costWithCarbon(
        unit.marginalCost,
        unit.carbon,
        scenario.carbonPrice
      ),
      unit,
    })),
    {
      id: LINK,
      cost: costWithCarbon(
        INTERCONNECTOR.importCost,
        INTERCONNECTOR.carbon,
        scenario.carbonPrice
      ),
    },
  ].sort((a, b) => a.cost - b.cost)

function solvePeriod(
  period: number,
  previous: Map<string, number>,
  offline: ReadonlySet<string>,
  scenario: Scenario,
  merit: Merit,
  fleet: readonly Unit[]
): Period {
  const demand = Math.round(DEMAND[period] * scenario.demandScale)
  const mw = new Map<string, number>()
  const availableOf = new Map<string, number>()
  const costOf = (unit: Unit) =>
    costWithCarbon(unit.marginalCost, unit.carbon, scenario.carbonPrice)

  for (const unit of fleet) {
    const weather =
      unit.fuel === "wind"
        ? Math.min(1, availability(unit.fuel, period) * scenario.windScale)
        : availability(unit.fuel, period)
    const available = offline.has(unit.id)
      ? 0
      : Math.round(unit.capacity * weather)
    availableOf.set(unit.id, available)
    mw.set(unit.id, 0)
  }

  const headroomOf = (unit: Unit) =>
    Math.min(
      availableOf.get(unit.id) ?? 0,
      (previous.get(unit.id) ?? 0) + RAMP_PER_PERIOD(unit)
    )

  /** The least a unit can be generating this period, given where it was last period. */
  const floorOf = (unit: Unit) => {
    const available = availableOf.get(unit.id) ?? 0
    if (available === 0) return 0
    const mustStay = Math.max(
      0,
      (previous.get(unit.id) ?? 0) - RAMP_PER_PERIOD(unit)
    )
    if (mustStay <= 0) return 0
    // Still synchronised and unable to come off: it has to be at least stable.
    return Math.min(available, Math.max(mustStay, unit.minStable))
  }

  let supplied = 0
  let marginal = "none"
  let price = 0

  /*
   * Three things are on the system before the market is asked for anything: plant that cannot
   * be turned down, fuel that costs nothing, and plant that is already running and cannot get
   * to zero inside half an hour. The last of those is the one the first version missed — the
   * merit loop stopped as soon as demand was met and left a running biomass unit at zero,
   * a 420 MW step on a machine that can move 360.
   */
  for (const unit of fleet) {
    const available = availableOf.get(unit.id) ?? 0
    if (available === 0) continue

    const mustRun = unit.minStable >= unit.capacity
    const freeFuel = unit.marginalCost === 0

    /*
     * Must-run plant is not ramp-limited from cold. A rate of zero means "does not follow
     * load", not "can never start" — read the second way, the clamp pinned the nuclear
     * station at the zero it was seeded with and it never generated for the whole day.
     */
    const out = mustRun
      ? available
      : freeFuel
        ? Math.min(available, headroomOf(unit))
        : floorOf(unit)

    mw.set(unit.id, Math.max(0, out))
    supplied += Math.max(0, out)
  }

  let residual = demand - supplied
  let interconnector = 0

  for (const step of merit) {
    if (residual <= 0.0001) break

    if (step.id === LINK) {
      interconnector = Math.min(residual, INTERCONNECTOR.capacity)
      if (interconnector > 0) {
        residual -= interconnector
        price = step.cost
        marginal = INTERCONNECTOR.name
      }
      continue
    }

    const unit = step.unit!
    if ((availableOf.get(unit.id) ?? 0) === 0) continue
    if (unit.marginalCost === 0 || unit.minStable >= unit.capacity) continue

    const current = mw.get(unit.id) ?? 0
    const headroom = headroomOf(unit) - current
    if (headroom <= 0) continue

    // Greedy commitment: a stopped unit only starts if there is room for its stable output.
    const take = Math.min(residual, headroom)
    if (current === 0 && take < unit.minStable) {
      if (headroom < unit.minStable) continue
      mw.set(unit.id, unit.minStable)
      residual -= unit.minStable
    } else {
      mw.set(unit.id, current + take)
      residual -= take
    }
    price = costOf(unit)
    marginal = unit.name
  }

  let curtailed = 0
  let unserved = 0

  if (residual > 0.0001) {
    unserved = residual
  } else if (residual < -0.0001) {
    /*
     * Long. Sell what the link will take, then spill free fuel, and only then instruct
     * thermal plant down below its stable output — which is the order a control room does it
     * in, and the order that costs least.
     */
    let surplus = -residual

    /*
     * If the link is importing, the first megawatt to give back is an imported one. This
     * branch used to write the export straight over the import, and a greedy commitment that
     * overshot by a few hundred megawatts while the link was running flat out made 1,000 MW
     * of import disappear from the books. The baseline never hit it — only the battery sits
     * behind the import there, and a battery has no minimum stable output — a £150 carbon
     * price put gas behind the import and the balance test found it in the first period.
     */
    const giveBack = Math.min(Math.max(0, interconnector), surplus)
    interconnector -= giveBack
    surplus -= giveBack

    const toExport = Math.min(surplus, INTERCONNECTOR.capacity)
    interconnector -= toExport
    surplus -= toExport

    for (const unit of fleet) {
      if (surplus <= 0.0001) break
      if (unit.marginalCost !== 0) continue
      const current = mw.get(unit.id) ?? 0
      const cut = Math.min(current, surplus)
      mw.set(unit.id, current - cut)
      curtailed += cut
      surplus -= cut
    }

    for (const unit of [...fleet].sort((a, b) => costOf(b) - costOf(a))) {
      if (surplus <= 0.0001) break
      if (unit.marginalCost === 0) continue
      const current = mw.get(unit.id) ?? 0
      const hardFloor = Math.max(
        0,
        (previous.get(unit.id) ?? 0) - RAMP_PER_PERIOD(unit)
      )
      const cut = Math.min(current - hardFloor, surplus)
      if (cut <= 0) continue
      mw.set(unit.id, current - cut)
      surplus -= cut
    }

    if (interconnector < 0) {
      price = INTERCONNECTOR.exportPrice
      marginal = "export"
    }
  }

  const outputs = fleet.map((unit) => ({
    unit,
    mw: Math.max(0, mw.get(unit.id) ?? 0),
    available: availableOf.get(unit.id) ?? 0,
  }))

  // Weighted by energy, and the import carries the neighbour's carbon rather than none.
  const servedMw =
    outputs.reduce((sum, o) => sum + o.mw, 0) + Math.max(0, interconnector)
  const grams =
    outputs.reduce((sum, o) => sum + o.mw * o.unit.carbon, 0) +
    Math.max(0, interconnector) * INTERCONNECTOR.carbon

  return {
    period,
    demand,
    outputs,
    interconnector,
    curtailed,
    price,
    carbonIntensity: servedMw > 0 ? grams / servedMw : 0,
    marginalUnit: marginal,
    unserved,
  }
}

/**
 * Solve the whole day.
 *
 * Twice, because a ramp limit makes each period depend on the one before it and the first
 * period has nothing before it. The second pass starts from the last period of the first, so
 * the day is consistent with itself at midnight instead of with an invented warm start.
 */
export function solve(
  offline: readonly string[] = [],
  scenario: Scenario = BASELINE,
  fleet: readonly Unit[] = UNITS
): Solution {
  const off = new Set(offline)
  const merit = meritOrder(scenario, fleet)
  let previous = new Map<string, number>(fleet.map((u) => [u.id, 0]))
  let periods: Period[] = []

  for (let pass = 0; pass < 2; pass++) {
    periods = []
    for (let p = 0; p < PERIODS; p++) {
      const solved = solvePeriod(p, previous, off, scenario, merit, fleet)
      periods.push(solved)
      previous = new Map(solved.outputs.map((o) => [o.unit.id, o.mw]))
    }
  }

  return { periods, offline, scenario, fleet }
}

/** Everything serving demand in a period: generation plus any import. */
export const served = (p: Period) =>
  p.outputs.reduce((sum, o) => sum + o.mw, 0) + Math.max(0, p.interconnector)

/** Energy over the day, MWh. */
export const energy = (periods: readonly Period[], of: (p: Period) => number) =>
  periods.reduce((sum, p) => sum + of(p) * HOURS_PER_PERIOD, 0)
