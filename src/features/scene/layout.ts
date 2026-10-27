import type { NodeId } from "@/lib/grid/units"

/**
 * Where things stand on the diorama.
 *
 * Scene coordinates, not data: the solver does not know or care where a plant is, and the
 * single-line diagram deliberately has no geography. The scene is the one place geography is
 * the point — the wind is on the northern plateau with the reservoir, the nuclear station is
 * alone in the west, the gas and the city share the centre, the link crosses the strait to the
 * east — so it is drawn from a layout the scene owns. x runs west → east, z runs north →
 * south, y is up; one unit is one tile of the board.
 */
export type Vec2 = readonly [x: number, z: number]

/** The board: a slab with a raised plateau in the north and a strait cut along the east. */
export const BOARD = {
  minX: -13,
  maxX: 11,
  minZ: -9,
  maxZ: 9,
  thickness: 1.1,
  radius: 1.2,
} as const

export const PLATEAU = {
  minX: -12.2,
  maxX: 3.4,
  minZ: -8.4,
  maxZ: -3.4,
  height: 0.6,
} as const

/** The strait the link crosses, and the far shore it comes from. */
export const STRAIT = { minX: 11.2, maxX: 13.6, minZ: -9, maxZ: 9 } as const
export const FAR_SHORE = {
  minX: 13.8,
  maxX: 15.2,
  minZ: -4.4,
  maxZ: 2.4,
} as const

/** The reservoir behind Glenock's dam, on the plateau. */
export const RESERVOIR = {
  minX: -4.4,
  maxX: -1.2,
  minZ: -6.2,
  maxZ: -3.9,
} as const

export const CITY_AT: Vec2 = [0.6, 1.0]
export const CITY_SIZE = 3.6

export const NODE_AT: Record<NodeId, Vec2> = {
  north: [-3.0, -2.2],
  west: [-6.2, 0.4],
  central: [-0.6, 4.6],
  east: [6.0, -1.4],
}

/**
 * One anchor per unit: where its connection leaves from and its label hangs. Farms spread
 * their machines around the anchor (see `FARM`).
 */
export const UNIT_AT: Record<string, Vec2> = {
  brae: [-8.4, -6.2],
  dunmoor: [1.2, -6.4],
  glenock: [-2.8, -3.4],
  hartmoor: [-9.6, 2.6],
  "calder-a": [-4.4, 6.8],
  "calder-b": [-1.4, 7.3],
  lowfield: [1.9, 7.4],
  keld: [4.3, 3.6],
  thornby: [6.9, 6.0],
  eastmarsh: [8.4, -4.8],
  fenley: [8.6, 1.8],
}

/** Machines in a farm, as offsets from its anchor. */
export const FARM: Record<string, readonly Vec2[]> = {
  brae: [
    [-2.4, -0.9],
    [-1.0, 0.7],
    [0.4, -1.1],
    [1.8, 0.6],
    [-3.2, 1.0],
  ],
  dunmoor: [
    [-1.0, -0.9],
    [0.4, 0.8],
    [1.4, -1.0],
  ],
}

/** Units standing on the plateau, whose cables drop down its southern face. */
export const ON_PLATEAU = new Set(["brae", "dunmoor"])

/** The link's pylons: far shore, near shore, and one midway to the city. */
export const LINK_FAR: Vec2 = [14.5, -1.0]
export const LINK_NEAR: Vec2 = [10.2, -1.2]
export const LINK_MID: Vec2 = [5.2, -0.2]
