import { useContext } from "react"

import { GridContext, type Grid } from "@/features/dashboard/grid-context"

/** The grid, from wherever it is read. The state itself lives in GridProvider. */
export function useGrid(): Grid {
  const grid = useContext(GridContext)
  if (!grid) throw new Error("useGrid must be used inside <GridProvider>")
  return grid
}
