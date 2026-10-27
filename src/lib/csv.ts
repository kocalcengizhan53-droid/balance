/**
 * RFC 4180 CSV: fields with a comma, a quote or a line break are quoted, quotes doubled, lines
 * ended with CRLF — what a spreadsheet opens without asking questions.
 */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  const field = (v: string | number) => {
    const s = String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((row) => row.map(field).join(",")).join("\r\n") + "\r\n"
}

/** Hands the browser a file. The byte-order mark makes Excel read £ and ₂ as UTF-8. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  )
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  })
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
