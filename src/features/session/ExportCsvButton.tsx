import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ExportView } from "@/features/session/session-api"
import { useSession } from "@/features/session/useSession"
import { downloadCsv, toCsv } from "@/lib/csv"

/** Downloads what the view shows as CSV; when someone is signed in, the audit log records it. */
export function ExportCsvButton({
  view,
  filename,
  rows,
}: {
  view: ExportView
  filename: string
  rows: () => readonly (readonly (string | number)[])[]
}) {
  const { recordExport } = useSession()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        downloadCsv(filename, toCsv(rows()))
        recordExport(view)
      }}
    >
      <Download /> Export CSV
    </Button>
  )
}
