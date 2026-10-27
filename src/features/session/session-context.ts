import { createContext } from "react"

import type {
  ExportView,
  Result,
  Role,
  Session,
} from "@/features/session/session-api"
import type { Edits, UnitEdit } from "@/lib/grid/edits"

/**
 * Who is in the control room, and what they have changed. The edits are inputs to the solver
 * like the units taken offline: GridProvider applies them before every solve.
 */
export type SessionState = {
  readonly session: Session | null
  /** Still finding out whether a returning visitor is signed in. */
  readonly checking: boolean
  readonly edits: Edits
  readonly signIn: (name: string, role: Role) => Promise<Result<Session>>
  readonly switchRole: (role: Role) => Promise<Result<Session>>
  readonly signOut: () => Promise<void>
  readonly saveEdit: (unitId: string, edit: UnitEdit) => Promise<Result<Edits>>
  readonly resetEdit: (unitId: string) => Promise<Result<Edits>>
  /** Logs a CSV download to the audit log when someone is signed in; a no-op otherwise. */
  readonly recordExport: (view: ExportView) => void
}

export const SessionContext = createContext<SessionState | null>(null)
