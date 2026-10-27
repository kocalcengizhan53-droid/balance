import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExportCsvButton } from "@/features/session/ExportCsvButton"
import { sessionApi, type AuditEntry } from "@/features/session/session-api"
import { SignInDialog } from "@/features/session/SignInDialog"
import { useSession } from "@/features/session/useSession"

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

type Log =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; entries: readonly AuditEntry[] }

/**
 * Who did what in this sandbox, newest first: sign-ins, role switches, every re-declaration with
 * the figures before and after, every download. Written by the API, never by the page.
 */
export function AuditPage() {
  const { session, edits, checking } = useSession()
  const [log, setLog] = useState<Log>({ state: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [signIn, setSignIn] = useState(false)

  // Read again whenever something that writes to the log may have happened.
  useEffect(() => {
    if (!session) return
    let live = true
    void sessionApi.audit().then((result) => {
      if (!live) return
      setLog(
        result.ok
          ? { state: "ready", entries: result.value.entries }
          : { state: "failed", message: result.message }
      )
    })
    return () => {
      live = false
    }
  }, [session, edits, attempt])

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every sign-in, role switch, re-declaration and download in this
            sandbox, recorded by the server.
          </p>
        </div>
        {session && log.state === "ready" && log.entries.length ? (
          <ExportCsvButton
            view="audit"
            filename="balance-audit.csv"
            rows={() => [
              ["Time (UTC)", "Who", "Role", "Action", "Detail"],
              ...log.entries.map((e) => [
                e.at,
                e.actor,
                e.role,
                e.action,
                e.detail,
              ]),
            ]}
          />
        ) : null}
      </div>

      {checking ? (
        <div className="panel h-40 animate-pulse" />
      ) : !session ? (
        <section className="panel flex flex-col items-start gap-3 px-4 py-5">
          <h2 className="text-sm font-semibold">
            The audit log belongs to a sandbox
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Sign in with a name and a role and you get a control room of your
            own for 24 hours. Every unit you re-declare and every file you
            download is recorded here.
          </p>
          <Button size="sm" onClick={() => setSignIn(true)}>
            Sign in
          </Button>
          <SignInDialog open={signIn} onOpenChange={setSignIn} />
        </section>
      ) : log.state === "failed" ? (
        <section
          role="alert"
          className="panel flex flex-col items-start gap-2 px-4 py-4"
        >
          <p className="text-sm">{log.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </Button>
        </section>
      ) : log.state === "loading" ? (
        <div className="panel h-40 animate-pulse" />
      ) : (
        <section className="panel min-w-0">
          <Table label="Audit log">
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Time</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.entries.map((e, i) => (
                <TableRow key={`${e.at}-${i}`}>
                  <TableCell className="figure text-xs whitespace-nowrap">
                    {time(e.at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.actor}{" "}
                    <Badge variant="outline" className="ml-1 capitalize">
                      {e.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.action}
                  </TableCell>
                  <TableCell className="min-w-64 text-muted-foreground">
                    {e.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  )
}
