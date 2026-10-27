import { useContext } from "react"

import { SessionContext } from "@/features/session/session-context"

export function useSession() {
  const session = useContext(SessionContext)
  if (!session)
    throw new Error("useSession must be used inside <SessionProvider>")
  return session
}
