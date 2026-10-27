import * as THREE from "three"

import {
  CITY_AT,
  CITY_SIZE,
  LINK_FAR,
  LINK_MID,
  LINK_NEAR,
  NODE_AT,
  ON_PLATEAU,
  PLATEAU,
  UNIT_AT,
  type Vec2,
} from "@/features/scene/layout"
import type { Period } from "@/lib/grid/dispatch"
import { INTERCONNECTOR, type NodeId } from "@/lib/grid/units"
import type { Series } from "@/lib/viz/fuel"

/**
 * Where the cables run. Plant to substation, substation to the city, laid on the board with
 * rounded corners; the link as an overhead line on pylons across the strait. One curve per
 * connection, carrying the megawatts and the load that set how its light moves.
 */

export const CABLE_Y = 0.07
export const PYLON_TOP = 2.3

type Point = [number, number, number]
const v = (p: Point) => new THREE.Vector3(...p)

/** A path through waypoints with each corner rounded, as one curve. */
function route(points: Point[], radius = 0.35): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>()
  let from = v(points[0])
  for (let i = 1; i < points.length - 1; i++) {
    const corner = v(points[i])
    const inDir = corner.clone().sub(from)
    const outDir = v(points[i + 1]).sub(corner)
    const r = Math.min(radius, inDir.length() / 2, outDir.length() / 2)
    const a = corner.clone().sub(inDir.normalize().multiplyScalar(r))
    const b = corner.clone().add(outDir.normalize().multiplyScalar(r))
    if (a.distanceTo(from) > 1e-4) path.add(new THREE.LineCurve3(from, a))
    path.add(new THREE.QuadraticBezierCurve3(a, corner, b))
    from = b
  }
  path.add(new THREE.LineCurve3(from, v(points[points.length - 1])))
  return path
}

/** An overhead span between two points, sagging in the middle. */
function span(a: Point, b: Point, sag = 0.5): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>()
  const mid: Point = [
    (a[0] + b[0]) / 2,
    Math.min(a[1], b[1]) - sag,
    (a[2] + b[2]) / 2,
  ]
  path.add(new THREE.QuadraticBezierCurve3(v(a), v(mid), v(b)))
  return path
}

const ground = ([x, z]: Vec2, y = CABLE_Y): Point => [x, y, z]

/** Where a connection from `p` enters the city block: the middle of the nearest side. */
function cityEdge([x, z]: Vec2): Vec2 {
  const h = CITY_SIZE / 2 + 0.25
  const dx = x - CITY_AT[0]
  const dz = z - CITY_AT[1]
  return Math.abs(dx) > Math.abs(dz)
    ? [
        CITY_AT[0] + Math.sign(dx) * h,
        CITY_AT[1] + Math.sign(dz) * Math.min(Math.abs(dz), 0.8),
      ]
    : [
        CITY_AT[0] + Math.sign(dx) * Math.min(Math.abs(dx), 0.8),
        CITY_AT[1] + Math.sign(dz) * h,
      ]
}

/** Plant to substation: down the plateau face if it stands up there, then along z, then x. */
function plantRoute(id: string, node: Vec2): Point[] {
  const [x, z] = UNIT_AT[id]
  if (ON_PLATEAU.has(id)) {
    const top = PLATEAU.height + CABLE_Y
    return [
      [x, top, z],
      [x, top, PLATEAU.maxZ - 0.1],
      [x, CABLE_Y, PLATEAU.maxZ + 0.35],
      [x, CABLE_Y, node[1]],
      ground(node),
    ]
  }
  return [ground([x, z]), [x, CABLE_Y, node[1]], ground(node)]
}

function nodeRoute(node: Vec2): Point[] {
  const edge = cityEdge(node)
  return [ground(node), [node[0], CABLE_Y, edge[1]], ground(edge)]
}

export type Cable = {
  id: string
  curve: THREE.CurvePath<THREE.Vector3>
  mw: number
  load: number
  colour: string
  radius: number
}

export function buildCables(
  now: Period,
  fuelHex: Record<Series, string>,
  neutral: string
): Cable[] {
  const cables: Cable[] = []
  const byNode = new Map<NodeId, { mw: number; capacity: number }>()
  for (const out of now.outputs) {
    const node = out.unit.node as NodeId
    const t = byNode.get(node) ?? { mw: 0, capacity: 0 }
    byNode.set(node, {
      mw: t.mw + Math.max(0, out.mw),
      capacity: t.capacity + out.unit.capacity,
    })
    cables.push({
      id: `u-${out.unit.id}`,
      curve: route(plantRoute(out.unit.id, NODE_AT[node])),
      mw: Math.abs(out.mw),
      load: out.available > 0 ? Math.abs(out.mw) / out.available : 0,
      colour: fuelHex[out.unit.fuel as Series],
      radius: 0.065,
    })
  }
  for (const [node, t] of byNode) {
    cables.push({
      id: `n-${node}`,
      curve: route(nodeRoute(NODE_AT[node])),
      mw: t.mw,
      load: t.capacity > 0 ? t.mw / t.capacity : 0,
      colour: neutral,
      radius: 0.09,
    })
  }
  const link = now.interconnector
  const far: Point = [LINK_FAR[0], PYLON_TOP, LINK_FAR[1]]
  const near: Point = [LINK_NEAR[0], PYLON_TOP, LINK_NEAR[1]]
  const mid: Point = [LINK_MID[0], PYLON_TOP, LINK_MID[1]]
  const edge = cityEdge(LINK_MID)
  const city: Point = [edge[0], 0.9, edge[1]]
  const legs: [Point, Point, number][] = [
    [far, near, 0.7],
    [near, mid, 0.6],
    [mid, city, 0.2],
  ]
  legs.forEach(([a, b, sag], i) => {
    cables.push({
      id: `link-${i}`,
      curve: link >= 0 ? span(a, b, sag) : span(b, a, sag),
      mw: Math.abs(link),
      load: Math.abs(link) / INTERCONNECTOR.capacity,
      colour: fuelHex.import,
      radius: 0.04,
    })
  })
  return cables
}
