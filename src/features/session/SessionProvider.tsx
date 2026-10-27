import { useEffect, useState, type ReactNode } from "react"

import {
  sessionApi,
  signedInHint,
  type Result,
  type Role,
  type Session,
} from "@/features/session/session-api"
import {
  SessionContext,
  type SessionState,
} from "@/features/session/session-context"
import type { Edits, UnitEdit } from "@/lib/grid/edits"

const NO_EDITS: Edits = {}

/**
 * The visitor's sandbox. A visitor who has never signed in costs no request at all: the page only
 * asks the API who is here when the cookie set at sign-in says someone might be.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [edits, setEdits] = useState<Edits>(NO_EDITS)
  const [checking, setChecking] = useState(signedInHint)

  useEffect(() => {
    if (!signedInHint()) return
    let live = true
    void (async () => {
      const current = await sessionApi.current()
      if (live && current.ok && current.value.session) {
        setSession(current.value.session)
        const loaded = await sessionApi.edits()
        if (live && loaded.ok) setEdits(loaded.value.edits)
      }
      if (live) setChecking(false)
    })()
    return () => {
      live = false
    }
  }, [])

  const keepEdits = (result: Result<{ edits: Edits }>): Result<Edits> => {
    if (!result.ok) return result
    setEdits(result.value.edits)
    return { ok: true, value: result.value.edits }
  }

  const keepSession = (
    result: Result<{ session: Session }>
  ): Result<Session> => {
    if (!result.ok) return result
    setSession(result.value.session)
    return { ok: true, value: result.value.session }
  }

  const state: SessionState = {
    session,
    checking,
    edits,
    signIn: async (name: string, role: Role) => {
      const result = keepSession(await sessionApi.signIn(name, role))
      if (result.ok) setEdits(NO_EDITS)
      return result
    },
    switchRole: async (role: Role) =>
      keepSession(await sessionApi.switchRole(role)),
    signOut: async () => {
      await sessionApi.signOut()
      setSession(null)
      setEdits(NO_EDITS)
    },
    saveEdit: async (unitId: string, edit: UnitEdit) =>
      keepEdits(await sessionApi.saveEdit(unitId, edit)),
    resetEdit: async (unitId: string) =>
      keepEdits(await sessionApi.resetEdit(unitId)),
    recordExport: (view) => {
      if (session) void sessionApi.recordExport(view)
    },
  }

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  )
}
