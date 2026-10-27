import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Role } from "@/features/session/session-api"
import { useSession } from "@/features/session/useSession"

const ROLES: readonly { role: Role; title: string; note: string }[] = [
  {
    role: "viewer",
    title: "Viewer",
    note: "Reads every page and exports CSV.",
  },
  {
    role: "operator",
    title: "Operator",
    note: "Also re-declares units. Every change is logged.",
  },
]

/** A name and a role, and the visitor has a control room of their own for 24 hours. */
export function SignInDialog({
  open,
  onOpenChange,
  defaultRole = "operator",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRole?: Role
}) {
  const { signIn } = useSession()
  const [name, setName] = useState("")
  const [role, setRole] = useState<Role>(defaultRole)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await signIn(name, role)
    setPending(false)
    if (result.ok) onOpenChange(false)
    else setError(result.message)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Sign in to the control room</DialogTitle>
            <DialogDescription>
              A private sandbox for 24 hours. What you change re-solves the day
              for you alone, and the audit log records it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signin-name" className="text-sm font-medium">
              Your name
            </label>
            <Input
              id="signin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deniz A."
              maxLength={40}
              required
              autoComplete="off"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Role</legend>
            {ROLES.map((r) => (
              <label
                key={r.role}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="signin-role"
                  value={r.role}
                  checked={role === r.role}
                  onChange={() => setRole(r.role)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.note}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
