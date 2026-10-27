import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"

import { memoryD1 } from "./memory-d1"
import {
  PER_IP,
  auditExport,
  auditGet,
  editDelete,
  editPut,
  editsGet,
  sessionDelete,
  sessionGet,
  sessionPatch,
  sessionPost,
  type Env,
} from "./api"

/**
 * The API against the real schema: who may do what, what is refused and why, and that every
 * change leaves a line in the audit log.
 */

const schema = readFileSync(
  resolve(import.meta.dirname, "../migrations/0001_sessions.sql"),
  "utf8"
)
let env: Env

beforeEach(() => {
  env = { DB: memoryD1(schema) }
})

const URL_BASE = "https://balance.test/api"
const req = (
  method: string,
  path: string,
  body?: unknown,
  cookie = "",
  ip = "203.0.113.7"
) =>
  new Request(URL_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "CF-Connecting-IP": ip,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function signIn(
  role: "viewer" | "operator",
  name = "Deniz A.",
  ip?: string
) {
  const res = await sessionPost(
    req("POST", "/session", { name, role }, "", ip),
    env
  )
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  return { res, cookie }
}

describe("session", () => {
  it("answers 200 with no session for a visitor who has not signed in", async () => {
    const res = await sessionGet(req("GET", "/session"), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ session: null })
  })

  it("signs in with a name and a role, sets an HttpOnly cookie, and remembers who you are", async () => {
    const { res, cookie } = await signIn("viewer")
    expect(res.status).toBe(201)
    expect(
      res.headers.getSetCookie().find((c) => c.startsWith("balance_session="))
    ).toMatch(/HttpOnly; Secure; SameSite=Lax/)
    const me = (await (
      await sessionGet(req("GET", "/session", undefined, cookie), env)
    ).json()) as { session: { name: string; role: string } }
    expect(me.session).toMatchObject({ name: "Deniz A.", role: "viewer" })
  })

  it("refuses a missing name, an unknown role and a body that is not JSON", async () => {
    expect(
      (
        await sessionPost(
          req("POST", "/session", { name: " ", role: "viewer" }),
          env
        )
      ).status
    ).toBe(422)
    expect(
      (
        await sessionPost(
          req("POST", "/session", { name: "A", role: "admin" }),
          env
        )
      ).status
    ).toBe(422)
    const form = new Request(`${URL_BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=A&role=viewer",
    })
    expect((await sessionPost(form, env)).status).toBe(415)
  })

  it(`allows ${PER_IP.count} sandboxes per address per ${PER_IP.minutes} minutes, then answers 429`, async () => {
    for (let i = 0; i < PER_IP.count; i++)
      expect((await signIn("viewer", `V${i}`, "198.51.100.1")).res.status).toBe(
        201
      )
    const sixth = await signIn("viewer", "V6", "198.51.100.1")
    expect(sixth.res.status).toBe(429)
    expect(sixth.res.headers.get("Retry-After")).toBe(
      String(PER_IP.minutes * 60)
    )
    expect((await signIn("viewer", "Other", "198.51.100.2")).res.status).toBe(
      201
    )
  })

  it("treats an expired sandbox as signed out", async () => {
    const { cookie } = await signIn("operator")
    await env.DB.prepare("UPDATE sessions SET expires_at = ?")
      .bind("2000-01-01T00:00:00.000Z")
      .run()
    expect(
      await (
        await sessionGet(req("GET", "/session", undefined, cookie), env)
      ).json()
    ).toEqual({ session: null })
    expect(
      (await editsGet(req("GET", "/edits", undefined, cookie), env)).status
    ).toBe(401)
  })

  it("switches role and records it", async () => {
    const { cookie } = await signIn("viewer")
    const res = await sessionPatch(
      req("PATCH", "/session", { role: "operator" }, cookie),
      env
    )
    expect(
      ((await res.json()) as { session: { role: string } }).session.role
    ).toBe("operator")
    const { entries } = (await (
      await auditGet(req("GET", "/audit", undefined, cookie), env)
    ).json()) as { entries: { action: string; detail: string }[] }
    expect(entries[0]).toMatchObject({
      action: "switched role",
      detail: "viewer → operator",
    })
  })

  it("signing out clears both cookies and takes the sandbox's edits and log with it", async () => {
    const { cookie } = await signIn("operator")
    await editPut(
      req("PUT", "/edits/calder-a", { capacity: 700 }, cookie),
      env,
      "calder-a"
    )
    const out = await sessionDelete(
      req("DELETE", "/session", undefined, cookie),
      env
    )
    expect(out.status).toBe(204)
    expect(
      out.headers.getSetCookie().every((c) => c.includes("Max-Age=0"))
    ).toBe(true)
    const left = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM edits) + (SELECT COUNT(*) FROM audit) AS n"
    ).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })
})

describe("edits", () => {
  it("lets an operator re-declare a unit and writes what changed to the audit log", async () => {
    const { cookie } = await signIn("operator")
    const res = await editPut(
      req(
        "PUT",
        "/edits/calder-a",
        { capacity: 700, marginalCost: 95 },
        cookie
      ),
      env,
      "calder-a"
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { edits: unknown }).edits).toEqual({
      "calder-a": { capacity: 700, marginalCost: 95 },
    })
    const { entries } = (await (
      await auditGet(req("GET", "/audit", undefined, cookie), env)
    ).json()) as {
      entries: { action: string; detail: string; unitId: string }[]
    }
    expect(entries[0]).toMatchObject({ action: "edited", unitId: "calder-a" })
    expect(entries[0].detail).toBe(
      "Calder A: capacity 910 MW → 700 MW, marginal cost £62/MWh → £95/MWh"
    )
  })

  it("refuses a viewer with 403 and someone signed out with 401", async () => {
    const viewer = await signIn("viewer")
    expect(
      (
        await editPut(
          req("PUT", "/edits/calder-a", { capacity: 700 }, viewer.cookie),
          env,
          "calder-a"
        )
      ).status
    ).toBe(403)
    expect(
      (
        await editPut(
          req("PUT", "/edits/calder-a", { capacity: 700 }),
          env,
          "calder-a"
        )
      ).status
    ).toBe(401)
  })

  it("answers 404 for a unit that does not exist and 422 for values out of range", async () => {
    const { cookie } = await signIn("operator")
    expect(
      (
        await editPut(
          req("PUT", "/edits/nowhere", { capacity: 700 }, cookie),
          env,
          "nowhere"
        )
      ).status
    ).toBe(404)
    const bad = await editPut(
      req("PUT", "/edits/calder-a", { capacity: 5000 }, cookie),
      env,
      "calder-a"
    )
    expect(bad.status).toBe(422)
    expect(bad.headers.get("Content-Type")).toBe("application/problem+json")
    expect(
      ((await bad.json()) as { errors: Record<string, string> }).errors.capacity
    ).toBeDefined()
  })

  it("validates against the unit as already edited, not as built", async () => {
    const { cookie } = await signIn("operator")
    await editPut(
      req("PUT", "/edits/calder-a", { capacity: 600 }, cookie),
      env,
      "calder-a"
    )
    // 700 is under the built capacity of 910 but over the re-declared 600.
    const res = await editPut(
      req("PUT", "/edits/calder-a", { minStable: 700 }, cookie),
      env,
      "calder-a"
    )
    expect(res.status).toBe(422)
    expect(
      ((await res.json()) as { errors: Record<string, string> }).errors
        .minStable
    ).toMatch(/600 MW/)
  })

  it("resets a unit to its declared figures", async () => {
    const { cookie } = await signIn("operator")
    await editPut(
      req("PUT", "/edits/calder-a", { capacity: 600 }, cookie),
      env,
      "calder-a"
    )
    const res = await editDelete(
      req("DELETE", "/edits/calder-a", undefined, cookie),
      env,
      "calder-a"
    )
    expect(((await res.json()) as { edits: unknown }).edits).toEqual({})
  })

  it("keeps each sandbox's edits to itself", async () => {
    const a = await signIn("operator", "A", "192.0.2.1")
    const b = await signIn("operator", "B", "192.0.2.2")
    await editPut(
      req("PUT", "/edits/calder-a", { capacity: 600 }, a.cookie),
      env,
      "calder-a"
    )
    expect(
      await (
        await editsGet(req("GET", "/edits", undefined, b.cookie), env)
      ).json()
    ).toEqual({ edits: {} })
  })
})

describe("exports", () => {
  it("records a download for a known view and refuses an unknown one", async () => {
    const { cookie } = await signIn("viewer")
    expect(
      (
        await auditExport(
          req("POST", "/audit/export", { view: "fleet" }, cookie),
          env
        )
      ).status
    ).toBe(204)
    expect(
      (
        await auditExport(
          req("POST", "/audit/export", { view: "passwords" }, cookie),
          env
        )
      ).status
    ).toBe(422)
    const { entries } = (await (
      await auditGet(req("GET", "/audit", undefined, cookie), env)
    ).json()) as { entries: { action: string; detail: string }[] }
    expect(entries[0]).toMatchObject({
      action: "downloaded",
      detail: "the fleet as CSV",
    })
  })
})
