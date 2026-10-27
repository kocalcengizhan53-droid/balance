import { RotateCcw } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SignInDialog } from "@/features/session/SignInDialog"
import { useSession } from "@/features/session/useSession"
import { validateEdit, type UnitEdit } from "@/lib/grid/edits"
import { UNITS, type Unit } from "@/lib/grid/units"

const FIELDS: readonly {
  key: keyof UnitEdit
  label: string
  unit: string
  step: string
}[] = [
  { key: "capacity", label: "Capacity", unit: "MW", step: "1" },
  { key: "minStable", label: "Minimum stable", unit: "MW", step: "1" },
  { key: "marginalCost", label: "Marginal cost", unit: "£/MWh", step: "0.5" },
]

/**
 * Re-declaring a unit: the three figures an operator changes when a plant's condition changes.
 * Saved, they become inputs to the solver and every page re-reads; the API checks the values
 * again and writes the change to the audit log.
 */
export function UnitEditor({ unit }: { unit: Unit }) {
  const { session, edits, saveEdit, resetEdit, switchRole } = useSession()
  const declared = UNITS.find((u) => u.id === unit.id) ?? unit
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(unit[f.key])]))
  )
  const [errors, setErrors] = useState<Partial<Record<keyof UnitEdit, string>>>(
    {}
  )
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [signIn, setSignIn] = useState(false)
  const operator = session?.role === "operator"

  async function save(event: FormEvent) {
    event.preventDefault()
    const edit: { -readonly [K in keyof UnitEdit]: number } = {}
    for (const f of FIELDS) {
      const value = Number(values[f.key])
      if (values[f.key] !== "" && value !== unit[f.key]) edit[f.key] = value
    }
    if (!Object.keys(edit).length) return setStatus("Nothing changed.")
    const found = validateEdit(unit, edit)
    setErrors(found)
    if (Object.keys(found).length) return setStatus(null)
    setPending(true)
    const result = await saveEdit(unit.id, edit)
    setPending(false)
    if (result.ok)
      setStatus("Saved. The day has been re-solved with the new figures.")
    else {
      setErrors(result.errors ?? {})
      setStatus(result.message)
    }
  }

  async function reset() {
    setPending(true)
    const result = await resetEdit(unit.id)
    setPending(false)
    if (result.ok) {
      setValues(
        Object.fromEntries(FIELDS.map((f) => [f.key, String(declared[f.key])]))
      )
      setErrors({})
      setStatus("Back to the declared figures.")
    } else setStatus(result.message)
  }

  return (
    <section
      aria-labelledby="re-declare"
      className="panel flex flex-col gap-3 px-4 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="re-declare" className="label">
          Re-declare
        </h3>
        {edits[unit.id] ? (
          <span className="text-xs text-live">edited in this sandbox</span>
        ) : null}
      </div>

      {!session ? (
        <>
          <p className="text-sm text-muted-foreground">
            Sign in as an operator to change this unit's figures.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setSignIn(true)}
          >
            Sign in
          </Button>
          <SignInDialog
            open={signIn}
            onOpenChange={setSignIn}
            defaultRole="operator"
          />
        </>
      ) : !operator ? (
        <>
          <p className="text-sm text-muted-foreground">
            Viewers read and export. Switch to operator to change figures.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void switchRole("operator")}
          >
            Switch to operator
          </Button>
        </>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3" noValidate>
          {FIELDS.map((f) => {
            const id = `edit-${f.key}`
            return (
              <div
                key={f.key}
                className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-3 gap-y-1"
              >
                <label htmlFor={id} className="text-sm">
                  {f.label}{" "}
                  <span className="text-muted-foreground">({f.unit})</span>
                  <span className="block text-xs text-muted-foreground">
                    declared {declared[f.key]}
                  </span>
                </label>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  aria-invalid={errors[f.key] ? true : undefined}
                  aria-describedby={errors[f.key] ? `${id}-error` : undefined}
                  className="text-right figure"
                />
                {errors[f.key] ? (
                  <p
                    id={`${id}-error`}
                    className="col-span-2 text-xs text-destructive"
                  >
                    {errors[f.key]}
                  </p>
                ) : null}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save and re-solve"}
            </Button>
            {edits[unit.id] ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void reset()}
              >
                <RotateCcw /> Declared figures
              </Button>
            ) : null}
          </div>
        </form>
      )}
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {status}
      </p>
    </section>
  )
}
