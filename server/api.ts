import { validateEdit, type Edits, type UnitEdit } from "../src/lib/grid/edits"
import { UNITS, type Unit } from "../src/lib/grid/units"

/**
 * The control room's API: a visitor signs in with a name and a role and gets a sandbox of their
 * own for 24 hours. Operators re-declare a unit's capacity, minimum stable output and cost;
 * viewers read. Every change, and every export, lands in an audit log.
 *
 * The edit is validated by the same function the browser uses, but here it decides. Errors are
 * RFC 9457 problem details, like the reservations API in this portfolio.
 */

export type Env = {
  DB: D1Database
  /** Sign-ins allowed per address per window. Production keeps the default; the browser suite raises it. */
  SIGN_INS_PER_IP?: string
}
export type Role = "viewer" | "operator"
export type Session = {
  id: string
  name: string
  role: Role
  expiresAt: string
}
export type AuditEntry = {
  at: string
  actor: string
  role: Role
  action: string
  unitId: string | null
  detail: string
}

export const SESSION_HOURS = 24
export const MAX_LIVE = 2000
export const PER_IP = { count: 5, minutes: 10 }
const COOKIE = "balance_session"
/** Readable by the page, so it only asks who is signed in when someone might be. */
export const MARK = "balance_signed_in"
const EXPORTS = {
  fleet: "the fleet",
  settlement: "the settlement run",
  audit: "the audit log",
} as const

const now = () => new Date().toISOString()
const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString()

export function problem(
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
  headers: HeadersInit = {}
) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, detail, ...extra }),
    {
      status,
      headers: { "Content-Type": "application/problem+json", ...headers },
    }
  )
}

function json(data: unknown, status = 200, headers?: Headers) {
  const h = headers ?? new Headers()
  h.set("Content-Type", "application/json")
  return new Response(JSON.stringify(data), { status, headers: h })
}

function cookie(request: Request, name: string) {
  return (
    request.headers
      .get("Cookie")
      ?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null
  )
}

function sessionCookies(id: string | null) {
  const h = new Headers()
  const age = id ? SESSION_HOURS * 3600 : 0
  h.append(
    "Set-Cookie",
    `${COOKIE}=${id ?? ""}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`
  )
  h.append(
    "Set-Cookie",
    `${MARK}=${id ? 1 : ""}; Path=/; Max-Age=${age}; Secure; SameSite=Lax`
  )
  return h
}

/** State-changing requests must be JSON: a cross-site form cannot send that without CORS. */
async function readJson(
  request: Request
): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return problem(415, "JSON required", "Send the body as application/json.")
  try {
    const body: unknown = await request.json()
    if (body && typeof body === "object" && !Array.isArray(body))
      return body as Record<string, unknown>
  } catch {
    // fall through
  }
  return problem(400, "Malformed body", "The body is not a JSON object.")
}

async function hash(text: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  )
  return [...bytes.slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function getSession(
  request: Request,
  env: Env
): Promise<Session | null> {
  const id = cookie(request, COOKIE)
  if (!id) return null
  const row = await env.DB.prepare(
    "SELECT id, name, role, expires_at FROM sessions WHERE id = ? AND expires_at > ?"
  )
    .bind(id, now())
    .first<{ id: string; name: string; role: Role; expires_at: string }>()
  return row
    ? { id: row.id, name: row.name, role: row.role, expiresAt: row.expires_at }
    : null
}

const publicSession = (s: Session) => ({
  name: s.name,
  role: s.role,
  expiresAt: s.expiresAt,
})

const auditStatement = (
  env: Env,
  s: Session,
  action: string,
  detail: string,
  unitId: string | null = null
) =>
  env.DB.prepare(
    "INSERT INTO audit (session_id, at, actor, role, action, unit_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(s.id, now(), s.name, s.role, action, unitId, detail)

async function listEdits(env: Env, sessionId: string): Promise<Edits> {
  const { results } = await env.DB.prepare(
    "SELECT unit_id, capacity, min_stable, marginal_cost FROM edits WHERE session_id = ?"
  )
    .bind(sessionId)
    .all<{
      unit_id: string
      capacity: number | null
      min_stable: number | null
      marginal_cost: number | null
    }>()
  return Object.fromEntries(
    results.map((r) => [
      r.unit_id,
      {
        ...(r.capacity !== null && { capacity: r.capacity }),
        ...(r.min_stable !== null && { minStable: r.min_stable }),
        ...(r.marginal_cost !== null && { marginalCost: r.marginal_cost }),
      },
    ])
  )
}

const signedOut = () =>
  problem(401, "Not signed in", "Sign in to get a sandbox of your own.")

// ── Session ──────────────────────────────────────────────────────────────────────────────────

export async function sessionGet(request: Request, env: Env) {
  const s = await getSession(request, env)
  return json({ session: s && publicSession(s) })
}

export async function sessionPost(request: Request, env: Env) {
  const body = await readJson(request)
  if (body instanceof Response) return body
  const name =
    typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
  if (!name || name.length > 40)
    return problem(422, "Invalid name", "A name of 1 to 40 characters.", {
      field: "name",
    })
  if (body.role !== "viewer" && body.role !== "operator")
    return problem(422, "Invalid role", "The role is viewer or operator.", {
      field: "role",
    })

  const ipHash = await hash(request.headers.get("CF-Connecting-IP") ?? "local")
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(now())
    .run()
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sessions WHERE ip_hash = ? AND created_at > ?"
  )
    .bind(ipHash, minutesAgo(PER_IP.minutes))
    .first<{ n: number }>()
  const allowed = Number(env.SIGN_INS_PER_IP) || PER_IP.count
  if ((recent?.n ?? 0) >= allowed)
    return problem(
      429,
      "Too many sign-ins",
      `At most ${allowed} sandboxes every ${PER_IP.minutes} minutes from one address.`,
      {},
      { "Retry-After": String(PER_IP.minutes * 60) }
    )
  const live = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sessions"
  ).first<{ n: number }>()
  if ((live?.n ?? 0) >= MAX_LIVE)
    return problem(503, "Sandboxes are full", "Try again in a few minutes.")

  // Signing in again replaces the sandbox you had.
  const previous = cookie(request, COOKIE)
  if (previous)
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(previous)
      .run()

  const s: Session = {
    id: crypto.randomUUID(),
    name,
    role: body.role,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(),
  }
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sessions (id, name, role, ip_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(s.id, s.name, s.role, ipHash, now(), s.expiresAt),
    auditStatement(env, s, "signed in", `as ${s.role}`),
  ])
  return json({ session: publicSession(s) }, 201, sessionCookies(s.id))
}

export async function sessionPatch(request: Request, env: Env) {
  const s = await getSession(request, env)
  if (!s) return signedOut()
  const body = await readJson(request)
  if (body instanceof Response) return body
  if (body.role !== "viewer" && body.role !== "operator")
    return problem(422, "Invalid role", "The role is viewer or operator.", {
      field: "role",
    })
  if (body.role === s.role) return json({ session: publicSession(s) })
  const next: Session = { ...s, role: body.role }
  await env.DB.batch([
    env.DB.prepare("UPDATE sessions SET role = ? WHERE id = ?").bind(
      next.role,
      s.id
    ),
    auditStatement(env, next, "switched role", `${s.role} → ${next.role}`),
  ])
  return json({ session: publicSession(next) })
}

export async function sessionDelete(request: Request, env: Env) {
  const s = await getSession(request, env)
  if (s)
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(s.id).run()
  return new Response(null, { status: 204, headers: sessionCookies(null) })
}

// ── Edits ────────────────────────────────────────────────────────────────────────────────────

export async function editsGet(request: Request, env: Env) {
  const s = await getSession(request, env)
  if (!s) return signedOut()
  return json({ edits: await listEdits(env, s.id) })
}

const FIELDS: readonly {
  key: keyof UnitEdit
  label: string
  unit: (v: number) => string
}[] = [
  { key: "capacity", label: "capacity", unit: (v) => `${v} MW` },
  { key: "minStable", label: "minimum stable", unit: (v) => `${v} MW` },
  { key: "marginalCost", label: "marginal cost", unit: (v) => `£${v}/MWh` },
]

async function guardEdit(request: Request, env: Env, unitId: string) {
  const s = await getSession(request, env)
  if (!s) return signedOut()
  if (s.role !== "operator")
    return problem(
      403,
      "Viewers cannot change units",
      "Switch to the operator role to re-declare a unit."
    )
  const unit = UNITS.find((u) => u.id === unitId)
  if (!unit)
    return problem(404, "No such unit", `There is no unit called "${unitId}".`)
  return { s, unit }
}

export async function editPut(request: Request, env: Env, unitId: string) {
  const guard = await guardEdit(request, env, unitId)
  if (guard instanceof Response) return guard
  const { s, unit } = guard
  const body = await readJson(request)
  if (body instanceof Response) return body

  const edit: { -readonly [K in keyof UnitEdit]: number } = {}
  for (const { key } of FIELDS) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== "number")
      return problem(422, "Invalid edit", `${key} must be a number.`, {
        errors: { [key]: "Not a number." },
      })
    edit[key] = body[key]
  }
  if (!Object.keys(edit).length)
    return problem(
      422,
      "Nothing to change",
      "Send capacity, minStable or marginalCost."
    )

  const existing = (await listEdits(env, s.id))[unit.id] ?? {}
  const current: Unit = { ...unit, ...existing }
  const errors = validateEdit(current, edit)
  if (Object.keys(errors).length)
    return problem(422, "Invalid edit", "Some values are out of range.", {
      errors,
    })

  const merged = { ...existing, ...edit }
  const changes = FIELDS.filter(
    ({ key }) => edit[key] !== undefined && edit[key] !== current[key]
  ).map(
    ({ key, label, unit: fmt }) =>
      `${label} ${fmt(current[key])} → ${fmt(edit[key]!)}`
  )
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO edits (session_id, unit_id, capacity, min_stable, marginal_cost, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, unit_id) DO UPDATE SET capacity = excluded.capacity, min_stable = excluded.min_stable,
       marginal_cost = excluded.marginal_cost, updated_at = excluded.updated_at`
    ).bind(
      s.id,
      unit.id,
      merged.capacity ?? null,
      merged.minStable ?? null,
      merged.marginalCost ?? null,
      now()
    ),
    auditStatement(
      env,
      s,
      "edited",
      changes.length
        ? `${unit.name}: ${changes.join(", ")}`
        : `${unit.name}: no change`,
      unit.id
    ),
  ])
  return json({ edits: await listEdits(env, s.id) })
}

export async function editDelete(request: Request, env: Env, unitId: string) {
  const guard = await guardEdit(request, env, unitId)
  if (guard instanceof Response) return guard
  const { s, unit } = guard
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM edits WHERE session_id = ? AND unit_id = ?"
    ).bind(s.id, unit.id),
    auditStatement(
      env,
      s,
      "reset",
      `${unit.name} back to its declared figures`,
      unit.id
    ),
  ])
  return json({ edits: await listEdits(env, s.id) })
}

// ── Audit ────────────────────────────────────────────────────────────────────────────────────

export async function auditGet(request: Request, env: Env) {
  const s = await getSession(request, env)
  if (!s) return signedOut()
  const { results } = await env.DB.prepare(
    "SELECT at, actor, role, action, unit_id, detail FROM audit WHERE session_id = ? ORDER BY id DESC LIMIT 200"
  )
    .bind(s.id)
    .all<{
      at: string
      actor: string
      role: Role
      action: string
      unit_id: string | null
      detail: string
    }>()
  const entries: AuditEntry[] = results.map((r) => ({
    at: r.at,
    actor: r.actor,
    role: r.role,
    action: r.action,
    unitId: r.unit_id,
    detail: r.detail,
  }))
  return json({ entries })
}

export async function auditExport(request: Request, env: Env) {
  const s = await getSession(request, env)
  if (!s) return signedOut()
  const body = await readJson(request)
  if (body instanceof Response) return body
  const view = body.view
  if (typeof view !== "string" || !(view in EXPORTS))
    return problem(
      422,
      "Unknown view",
      `The view is one of ${Object.keys(EXPORTS).join(", ")}.`,
      { field: "view" }
    )
  await auditStatement(
    env,
    s,
    "downloaded",
    `${EXPORTS[view as keyof typeof EXPORTS]} as CSV`
  ).run()
  return new Response(null, { status: 204 })
}
