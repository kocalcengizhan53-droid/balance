import { LogIn, LogOut } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SignInDialog } from "@/features/session/SignInDialog"
import { useSession } from "@/features/session/useSession"

/** Who is in the room, in the rail: sign in, switch role, sign out. */
export function SessionCard() {
  const { session, checking, switchRole, signOut } = useSession()
  const [open, setOpen] = useState(false)

  if (checking)
    return (
      <div className="panel mx-1 h-16 animate-pulse group-data-[collapsible=icon]:hidden" />
    )

  if (!session)
    return (
      <div className="panel mx-1 flex flex-col gap-2 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
        <p className="text-[0.6875rem] text-muted-foreground">
          Sign in for a sandbox: re-declare units, keep an audit log.
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <LogIn /> Sign in
        </Button>
        <SignInDialog open={open} onOpenChange={setOpen} />
      </div>
    )

  const other = session.role === "operator" ? "viewer" : "operator"
  return (
    <div className="panel mx-1 flex flex-col gap-2 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{session.name}</span>
        <Badge
          variant={session.role === "operator" ? "default" : "outline"}
          className="capitalize"
        >
          {session.role}
        </Badge>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => void switchRole(other)}
        >
          Switch to {other}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Sign out"
          onClick={() => void signOut()}
        >
          <LogOut />
        </Button>
      </div>
    </div>
  )
}
