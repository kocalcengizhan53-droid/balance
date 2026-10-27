import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"

import {
  FARM,
  ON_PLATEAU,
  PLATEAU,
  UNIT_AT,
  type Vec2,
} from "@/features/scene/layout"
import type { Materials } from "@/features/scene/materials"
import type { UnitOutput } from "@/lib/grid/dispatch"
import type { Unit } from "@/lib/grid/units"

/**
 * The plants, in one material language: every body is the same matte structure, and the fuel
 * appears only as an accent that glows with the plant's load — the hub of a turbine, the rim of
 * a cooling tower, the tips of a gas station's stacks, the face of a solar array. A plant out of
 * service turns to a pale ghost of itself and its accent goes dark.
 */

/** The accent: the fuel colour as light, at a strength set by the load. */
function useAccent(colour: string, strength: number) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.4, toneMapped: false }),
    []
  )
  useEffect(() => () => material.dispose(), [material])
  useLayoutEffect(() => {
    material.color.set(colour)
    material.emissive.set(colour)
    material.emissiveIntensity = strength
  }, [material, colour, strength])
  return material
}

const groundY = (id: string) => (ON_PLATEAU.has(id) ? PLATEAU.height : 0)

/* ---------- machines ------------------------------------------------------------------- */

/** One blade, in a group so it turns about the hub rather than its own middle. */
function Blade({ index, body }: { index: number; body: THREE.Material }) {
  return (
    <group rotation-z={(index * Math.PI * 2) / 3}>
      <mesh position-y={0.5} material={body} castShadow>
        <boxGeometry args={[0.07, 1.0, 0.025]} />
      </mesh>
    </group>
  )
}

function WindFarm({ id, body, accent, load }: Body & { id: string }) {
  const machines = FARM[id] ?? [[0, 0]]
  return (
    <>
      {machines.map((at, i) => (
        <Turbine
          key={i}
          at={at}
          body={body}
          accent={accent}
          speed={load > 0 ? 0.5 + load * 4 : 0}
          phase={i * 1.7}
        />
      ))}
    </>
  )
}

type TurbineProps = {
  at: Vec2
  body: THREE.Material
  accent: THREE.Material
  speed: number
  phase: number
}

function Turbine(props: TurbineProps) {
  const rotor = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (rotor.current) rotor.current.rotation.z -= delta * props.speed
  })
  const { at, body, accent, phase } = props
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={0.6}>
      <mesh position-y={1.0} material={body} castShadow>
        <cylinderGeometry args={[0.06, 0.11, 2.0, 10]} />
      </mesh>
      <mesh position={[0, 2.05, -0.05]} material={body} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.42]} />
      </mesh>
      <group ref={rotor} position={[0, 2.05, 0.2]} rotation-z={phase}>
        <mesh material={accent}>
          <sphereGeometry args={[0.14, 12, 10]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <Blade key={i} index={i} body={body} />
        ))}
      </group>
    </group>
  )
}

type Body = { body: THREE.Material; accent: THREE.Material; load: number }

function Solar({ body, accent }: Body) {
  const panels = useRef<THREE.InstancedMesh>(null)
  const cells = useMemo(() => {
    const out: [number, number][] = []
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) out.push([(c - 2.5) * 0.62, (r - 1.5) * 0.62])
    return out
  }, [])
  useEffect(() => {
    const m = panels.current
    if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([x, z], i) => {
      o.position.set(x, 0.32, z)
      o.rotation.set(-0.5, 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [cells])
  return (
    <>
      <instancedMesh
        ref={panels}
        args={[undefined, undefined, cells.length]}
        material={accent}
        castShadow
      >
        <boxGeometry args={[0.54, 0.04, 0.42]} />
      </instancedMesh>
      {[-0.93, 0.93].map((z) => (
        <mesh key={z} position={[0, 0.14, z]} material={body}>
          <boxGeometry args={[3.7, 0.08, 0.06]} />
        </mesh>
      ))}
    </>
  )
}

const TOWER_PROFILE = (() => {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    // A hyperboloid: wide at the foot, waisted at two thirds, flaring a little at the lip.
    const r =
      0.74 +
      0.36 * Math.pow(Math.abs(t - 0.68) / 0.68, 1.6) * (t < 0.68 ? 1 : 0.45)
    pts.push(new THREE.Vector2(r, t * 2.5))
  }
  return pts
})()

function Steam({
  material,
  rate,
}: {
  material: THREE.MeshStandardMaterial
  rate: number
}) {
  const puffs = useRef<THREE.Group>(null)
  const clock = useRef(0)
  useFrame((_, delta) => {
    const g = puffs.current
    if (!g) return
    clock.current += delta * (0.12 + rate * 0.16)
    g.children.forEach((child, i) => {
      const t = (clock.current + i / g.children.length) % 1
      child.position.set(
        Math.sin(i * 2.3) * 0.2 + t * 0.6,
        2.6 + t * 2.2,
        Math.cos(i * 1.7) * 0.2 - t * 0.3
      )
      child.scale.setScalar(0.35 + t * 0.75)
      ;((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity =
        (1 - t) * 0.42 * Math.min(1, rate * 1.5)
    })
  })
  const mats = useMemo(
    () => Array.from({ length: 6 }, () => material.clone()),
    [material]
  )
  return (
    <group ref={puffs}>
      {mats.map((m, i) => (
        <mesh key={i} material={m}>
          <icosahedronGeometry args={[0.5, 1]} />
        </mesh>
      ))}
    </group>
  )
}

function Nuclear({
  body,
  accent,
  load,
  steam,
}: Body & { steam: THREE.MeshStandardMaterial }) {
  return (
    <>
      <group position={[-0.9, 0, 0.5]}>
        <mesh material={body} castShadow receiveShadow>
          <latheGeometry args={[TOWER_PROFILE, 40]} />
        </mesh>
        <mesh position-y={2.5} rotation-x={Math.PI / 2} material={accent}>
          <torusGeometry args={[0.82, 0.08, 8, 40]} />
        </mesh>
        {load > 0 ? <Steam material={steam} rate={load} /> : null}
      </group>
      <group position={[1.0, 0, -0.5]}>
        <mesh position-y={0.4} material={body} castShadow>
          <cylinderGeometry args={[0.66, 0.7, 0.8, 32]} />
        </mesh>
        <mesh position-y={0.8} material={body} castShadow>
          <sphereGeometry
            args={[0.66, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
        </mesh>
        <mesh position-y={0.82} rotation-x={Math.PI / 2} material={accent}>
          <torusGeometry args={[0.67, 0.035, 8, 40]} />
        </mesh>
      </group>
      <mesh position={[1.0, 0.4, 0.8]} material={body} castShadow>
        <boxGeometry args={[1.5, 0.8, 0.8]} />
      </mesh>
    </>
  )
}

function Gas({ body, accent }: Body) {
  return (
    <>
      <mesh position={[0, 0.42, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.84, 0.9]} />
      </mesh>
      <mesh position={[0, 0.5, 0.46]} material={accent}>
        <boxGeometry args={[1.25, 0.14, 0.02]} />
      </mesh>
      <mesh position={[0.95, 0.55, -0.05]} material={body} castShadow>
        <boxGeometry args={[0.5, 1.1, 0.7]} />
      </mesh>
      {[-0.35, 0.25].map((dx) => (
        <group key={dx} position={[dx, 0, -0.62]}>
          <mesh position-y={1.05} material={body} castShadow>
            <cylinderGeometry args={[0.11, 0.14, 2.1, 14]} />
          </mesh>
          <mesh position-y={2.1} rotation-x={Math.PI / 2} material={accent}>
            <torusGeometry args={[0.14, 0.06, 8, 20]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Biomass({ body, accent }: Body) {
  return (
    <>
      <mesh
        position={[-0.35, 0.45, 0]}
        material={body}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.2, 0.9, 0.9]} />
      </mesh>
      {[0.6, 1.25].map((dx) => (
        <group key={dx} position={[dx, 0, -0.1]}>
          <mesh position-y={0.7} material={body} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.4, 20]} />
          </mesh>
          <mesh position-y={1.4} material={body}>
            <sphereGeometry
              args={[0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
          </mesh>
          <mesh position-y={1.0} rotation-x={Math.PI / 2} material={accent}>
            <torusGeometry args={[0.31, 0.06, 8, 24]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.6, 1.3, -0.2]} material={body} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.9, 12]} />
      </mesh>
    </>
  )
}

/** Glenock is a dam across the plateau's southern face, with its powerhouse at the foot. */
function Hydro({ body, accent }: Body) {
  return (
    <>
      <mesh
        position={[0, PLATEAU.height / 2 + 0.06, -0.15]}
        material={body}
        castShadow
      >
        <boxGeometry args={[3.0, PLATEAU.height + 0.25, 0.32]} />
      </mesh>
      <mesh position={[0, PLATEAU.height / 2, 0.03]} material={accent}>
        <boxGeometry args={[0.6, PLATEAU.height, 0.02]} />
      </mesh>
      <mesh position={[0.9, 0.22, 0.45]} material={body} castShadow>
        <boxGeometry args={[0.8, 0.44, 0.5]} />
      </mesh>
    </>
  )
}

function Battery({ body, accent }: Body) {
  const slots: [number, number][] = [
    [-0.55, -0.3],
    [0.55, -0.3],
    [-0.55, 0.3],
    [0.55, 0.3],
    [-0.55, 0.9],
    [0.55, 0.9],
  ]
  return (
    <>
      {slots.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z - 0.3]}>
          <mesh position-y={0.22} material={body} castShadow>
            <boxGeometry args={[0.95, 0.44, 0.42]} />
          </mesh>
          <mesh position={[0, 0.3, 0.215]} material={accent}>
            <boxGeometry args={[0.75, 0.1, 0.01]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/* ---------- a plant on its pad ---------------------------------------------------------- */

export function Plant({
  unit,
  out,
  colour,
  offline,
  hovered,
  materials,
  glow,
  onToggle,
  onHover,
}: {
  unit: Unit
  out: UnitOutput
  colour: string
  offline: boolean
  hovered: boolean
  materials: Materials
  /** How far the accents are pushed past white: all the way on a dark board, a little on a pale one. */
  glow: number
  onToggle: () => void
  onHover: (on: boolean) => void
}) {
  const [x, z] = UNIT_AT[unit.id]
  const load =
    offline || out.available <= 0 ? 0 : Math.abs(out.mw) / out.available
  const accent = useAccent(colour, offline ? 0 : (0.5 + load * 4) * glow)
  const body = offline ? materials.ghost : materials.structure
  const props: Body = { body, accent, load }

  let model: React.ReactNode
  switch (unit.fuel) {
    case "wind":
      model = <WindFarm id={unit.id} {...props} />
      break
    case "solar":
      model = <Solar {...props} />
      break
    case "nuclear":
      model = <Nuclear {...props} steam={materials.steam} />
      break
    case "gas":
      model = <Gas {...props} />
      break
    case "biomass":
      model = <Biomass {...props} />
      break
    case "hydro":
      model = <Hydro {...props} />
      break
    default:
      model = <Battery {...props} />
  }

  const padSize =
    unit.fuel === "wind"
      ? 0
      : unit.fuel === "hydro"
        ? 0
        : unit.fuel === "solar"
          ? 2.4
          : 1.7
  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation()
  return (
    <group
      position={[x, groundY(unit.id), z]}
      onClick={(e) => (stop(e), onToggle())}
      onPointerOver={(e) => (stop(e), onHover(true))}
      onPointerOut={(e) => (stop(e), onHover(false))}
    >
      {padSize > 0 ? (
        <mesh
          position-y={0.012}
          rotation-x={-Math.PI / 2}
          material={hovered ? materials.padHot : materials.pad}
          receiveShadow
        >
          <circleGeometry args={[padSize, 40]} />
        </mesh>
      ) : null}
      {offline ? (
        <mesh position-y={0.03} rotation-x={-Math.PI / 2}>
          <ringGeometry
            args={[Math.max(padSize, 1.2), Math.max(padSize, 1.2) + 0.08, 48]}
          />
          <meshBasicMaterial color="#f05252" toneMapped={false} />
        </mesh>
      ) : null}
      {model}
    </group>
  )
}
