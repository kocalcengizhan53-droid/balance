import type { NodeId } from "@/lib/grid/units"

/**
 * Where things stand in the region.
 *
 * Scene coordinates, not data: the solver does not know or care where a plant is, and the
 * single-line diagram deliberately has no geography. The scene is the one place geography is
 * the point — the north is windy, the nuclear station is alone in the west, the gas and the
 * city share the centre, the link leaves to the east — so it is drawn from a layout the scene
 * owns. x runs west → east, z runs north → south, y is up.
 */
export type Vec2 = readonly [x: number, z: number]

export const BUS: Vec2 = [0, 0]

export const NODE_AT: Record<NodeId, Vec2> = {
  north: [-4.5, -4.8],
  west: [-7.5, 1.6],
  central: [1.8, 4.2],
  east: [7.2, -1.6],
}

export const UNIT_AT: Record<string, Vec2> = {
  brae: [-9.2, -6.6],
  dunmoor: [-3.2, -7.8],
  glenock: [-8.2, -2.6],
  hartmoor: [-10.8, 3.8],
  "calder-a": [-1.6, 6.9],
  "calder-b": [0.8, 7.8],
  lowfield: [3.9, 7.2],
  thornby: [5.6, 5.1],
  keld: [3.4, 2.4],
  eastmarsh: [9.8, -3.8],
  fenley: [9.9, 1.4],
}

/** The link's pylon at the region's edge, and the point the line leaves the scene from. */
export const LINK_AT: Vec2 = [12.6, -1.2]
export const LINK_AWAY: Vec2 = [15.5, -1.0]

/** Terrain, cheap and deterministic: three sines, no texture, no fetch. */
export function terrainHeight(x: number, z: number): number {
  return (
    0.42 * Math.sin(x * 0.42) * Math.cos(z * 0.36) +
    0.2 * Math.sin(x * 1.25 + z * 0.85) +
    0.12 * Math.cos(z * 1.7 - x * 0.55)
  )
}

export const REGION = { width: 84, depth: 64, segments: 96 } as const
