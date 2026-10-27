import type { Edits, UnitEdit } from "@/lib/grid/edits"

export type Role = "viewer" | "operator"
export type Session = {
  readonly name: string
  readonly role: Role
  readonly expiresAt: string
}
export type AuditEntry = {
  readonly at: string
  readonly actor: string
  readonly role: Role
  readonly action: string
  readonly unitId: string | null
  readonly detail: string
}
export type ExportView = "fleet" | "settlement" | "audit"

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly message: string
      readonly errors?: Partial<Record<keyof UnitEdit, string>>
    }

/** Set beside the session cookie; lets the page skip the question for visitors who never signed in. */
export const signedInHint = () =>
  document.cookie.split("; ").includes("balance_signed_in=1")

async function call<T>(
  path: string,
  init: RequestInit = {}
): Promise<Result<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    })
    if (res.status === 204) return { ok: true, value: undefined as T }
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      errors?: Partial<Record<keyof UnitEdit, string>>
    }
    if (!res.ok)
      return {
        ok: false,
        message: body.detail ?? `The control room answered ${res.status}.`,
        errors: body.errors,
      }
    return { ok: true, value: body as T }
  } catch {
    return {
      ok: false,
      message:
        "The control room cannot be reached. Check the connection and try again.",
    }
  }
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const sessionApi = {
  current: () => call<{ session: Session | null }>("/session"),
  signIn: (name: string, role: Role) =>
    call<{ session: Session }>("/session", send("POST", { name, role })),
  switchRole: (role: Role) =>
    call<{ session: Session }>("/session", send("PATCH", { role })),
  signOut: () => call<void>("/session", send("DELETE")),
  edits: () => call<{ edits: Edits }>("/edits"),
  saveEdit: (unitId: string, edit: UnitEdit) =>
    call<{ edits: Edits }>(
      `/edits/${encodeURIComponent(unitId)}`,
      send("PUT", edit)
    ),
  resetEdit: (unitId: string) =>
    call<{ edits: Edits }>(
      `/edits/${encodeURIComponent(unitId)}`,
      send("DELETE")
    ),
  audit: () => call<{ entries: AuditEntry[] }>("/audit"),
  recordExport: (view: ExportView) =>
    call<void>("/audit/export", send("POST", { view })),
}
