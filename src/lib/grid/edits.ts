// Shared with the API in functions/, which bundles without the "@/" alias — hence the relative import.
import type { Unit } from "./units"

/**
 * An operator's changes to a unit: the three figures a control room actually re-declares when a
 * plant's condition changes. Everything else about a unit — its fuel, its node, its ramp — is
 * physics or geography and stays as built.
 */
export type UnitEdit = {
  readonly capacity?: number
  readonly minStable?: number
  readonly marginalCost?: number
}

/** Edits by unit id. */
export type Edits = Readonly<Record<string, UnitEdit>>

export const LIMITS = {
  capacity: { min: 1, max: 3000 },
  marginalCost: { min: 0, max: 500 },
} as const

/**
 * What is wrong with an edit, field by field, or an empty object when nothing is. The same check
 * runs in the browser, to say so before saving, and in the API, which is the one that decides.
 */
export function validateEdit(
  unit: Unit,
  edit: UnitEdit
): Partial<Record<keyof UnitEdit, string>> {
  const errors: Partial<Record<keyof UnitEdit, string>> = {}
  const capacity = edit.capacity ?? unit.capacity
  const minStable = edit.minStable ?? unit.minStable
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n)

  if (edit.capacity !== undefined) {
    if (
      !whole(edit.capacity) ||
      capacity < LIMITS.capacity.min ||
      capacity > LIMITS.capacity.max
    )
      errors.capacity = `Capacity is a whole number of MW from ${LIMITS.capacity.min} to ${LIMITS.capacity.max}.`
  }
  if (edit.minStable !== undefined || edit.capacity !== undefined) {
    if (!whole(minStable) || minStable < 0)
      errors.minStable =
        "Minimum stable output is a whole number of MW, 0 or more."
    else if (minStable > capacity)
      errors.minStable = `Minimum stable output cannot exceed capacity (${capacity} MW).`
  }
  if (edit.marginalCost !== undefined) {
    const cost = edit.marginalCost
    if (
      typeof cost !== "number" ||
      !Number.isFinite(cost) ||
      cost < LIMITS.marginalCost.min ||
      cost > LIMITS.marginalCost.max
    )
      errors.marginalCost = `Marginal cost is £${LIMITS.marginalCost.min}–${LIMITS.marginalCost.max} per MWh.`
  }
  return errors
}

/** The fleet with edits applied; unknown ids and empty edits change nothing. */
export function applyEdits(
  fleet: readonly Unit[],
  edits: Edits
): readonly Unit[] {
  if (!Object.keys(edits).length) return fleet
  return fleet.map((unit) => {
    const edit = edits[unit.id]
    return edit ? { ...unit, ...edit } : unit
  })
}
