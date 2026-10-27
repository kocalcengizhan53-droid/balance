import type { Column } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

/** A header that sorts its column, and says which way it is sorted to a screen reader. */
export function SortHeader<T>({
  column,
  label,
}: {
  column: Column<T>
  label: string
}) {
  const dir = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        className={`size-3 ${dir ? "text-foreground" : ""}`}
        aria-hidden="true"
      />
      <span className="sr-only">
        {dir === "asc"
          ? ", sorted ascending"
          : dir === "desc"
            ? ", sorted descending"
            : ", sort"}
      </span>
    </button>
  )
}
