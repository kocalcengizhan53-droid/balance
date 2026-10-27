import { describe, expect, it } from "vitest"

import { toCsv } from "@/lib/csv"

describe("toCsv", () => {
  it("quotes only the fields that need it and doubles their quotes", () => {
    expect(
      toCsv([
        ["unit", "note"],
        ["Calder A", 'cost "high", ramping'],
        ["Brae", 1020],
      ])
    ).toBe('unit,note\r\nCalder A,"cost ""high"", ramping"\r\nBrae,1020\r\n')
  })

  it("quotes a field with a line break", () => {
    expect(toCsv([["a\nb"]])).toBe('"a\nb"\r\n')
  })
})
