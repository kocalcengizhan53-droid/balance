import { describe, expect, it } from "vitest"

import {
  BOARD,
  FARM,
  NODE_AT,
  ON_PLATEAU,
  PLATEAU,
  UNIT_AT,
} from "@/features/scene/layout"
import { NODES, UNITS } from "@/lib/grid/units"

/**
 * The scene's layout is hand-placed; the fleet is data. These keep the two in step, so a unit
 * added to the fleet cannot silently vanish from the region or stand in the sea.
 */
describe("scene layout", () => {
  const inside = (
    [x, z]: readonly [number, number],
    r: { minX: number; maxX: number; minZ: number; maxZ: number }
  ) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ

  it("places every unit and every node of the fleet, on the board", () => {
    for (const u of UNITS) {
      expect(UNIT_AT[u.id], u.id).toBeDefined()
      expect(inside(UNIT_AT[u.id], BOARD), u.id).toBe(true)
    }
    for (const id of Object.keys(NODES)) {
      expect(NODE_AT[id as keyof typeof NODE_AT], id).toBeDefined()
      expect(inside(NODE_AT[id as keyof typeof NODE_AT], BOARD), id).toBe(true)
    }
  })

  it("stands the plateau's machines on the plateau", () => {
    for (const id of ON_PLATEAU) {
      const [ax, az] = UNIT_AT[id]
      for (const [dx, dz] of FARM[id] ?? [[0, 0]])
        expect(inside([ax + dx, az + dz], PLATEAU), `${id} machine`).toBe(true)
    }
  })

  it("keeps the rest off it", () => {
    for (const u of UNITS)
      if (!ON_PLATEAU.has(u.id) && u.fuel !== "hydro")
        expect(inside(UNIT_AT[u.id], PLATEAU), u.id).toBe(false)
  })
})
