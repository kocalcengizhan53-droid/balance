import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  Environment,
  Grid,
  Html,
  Lightformer,
  Line,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei"
import { useReducedMotion } from "motion/react"
import * as THREE from "three"

import { useGrid } from "@/features/dashboard/useGrid"
import {
  BUS,
  LINK_AT,
  LINK_AWAY,
  NODE_AT,
  REGION,
  UNIT_AT,
  terrainHeight,
  type Vec2,
} from "@/features/scene/layout"
import {
  useFuelHex,
  useSceneTheme,
  type SceneTheme,
} from "@/features/scene/palette"
import type { Period, UnitOutput } from "@/lib/grid/dispatch"
import {
  INTERCONNECTOR,
  NODES,
  UNITS,
  type NodeId,
  type Unit,
} from "@/lib/grid/units"
import type { Series } from "@/lib/viz/fuel"

/**
 * The region, as a place.
 *
 * Everything above this on the page is an instrument; this is the thing the instruments are
 * reading. Plants stand where they stand, sized by capacity and lit by their output; power
 * moves as particles along the lines, each line carrying a count of them proportional to the
 * megawatts on it and moving at a speed set by how hard the plant behind it is working; the
 * sun crosses the sky with the clock, so the solar farm comes alive at nine and the city
 * lights come up at dusk. Take a plant out and its particles stop, and the ones feeding the
 * city from the east thicken, because that is what the solver decided.
 *
 * Nothing is fetched. The environment is three light panels baked once; the terrain is three
 * sines; the colours are read from the page's own stylesheet.
 */

const at = ([x, z]: Vec2): [number, number, number] => [
  x,
  terrainHeight(x, z),
  z,
]
const lift = (
  p: [number, number, number],
  dy: number
): [number, number, number] => [p[0], p[1] + dy, p[2]]

/* ---------- Ground --------------------------------------------------------------------- */

function Terrain({ theme }: { theme: SceneTheme }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      REGION.width,
      REGION.depth,
      REGION.segments,
      Math.round((REGION.segments * REGION.depth) / REGION.width)
    )
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)))
    }
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={theme.ground}
          emissive={theme.ground}
          emissiveIntensity={0.35}
          flatShading
          roughness={0.95}
        />
      </mesh>
      <Grid
        position={[0, 0.02, 0]}
        args={[40, 30]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={theme.cell}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={theme.section}
        fadeDistance={30}
        fadeStrength={1.4}
        followCamera={false}
        infiniteGrid={false}
      />
    </group>
  )
}

/* ---------- Sky ------------------------------------------------------------------------ */

/** Hour of the day → where the sun is and how strong. Night keeps a low blue ambient. */
function sunFor(period: number) {
  const hour = period / 2
  const t = (hour - 6) / 12 // 0 at sunrise, 1 at sunset
  const elevation = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI)
  const azimuth = ((hour - 12) / 12) * Math.PI // east → west
  const up = hour >= 6 && hour <= 18
  return {
    position: [
      Math.cos(azimuth) * 22,
      up ? 2 + elevation * 20 : -4,
      Math.sin(azimuth) * 10 + 8,
    ] as [number, number, number],
    strength: up ? 0.35 + elevation * 2.1 : 0,
    warmth: up ? 1 - Math.min(1, elevation * 2.2) : 1, // 1 at the horizon
    night: up ? 1 - Math.min(1, elevation * 3) : 1,
  }
}

function Sky({ period, theme }: { period: number; theme: SceneTheme }) {
  const sun = sunFor(period)
  const sunColour = new THREE.Color(theme.sunDay).lerp(
    new THREE.Color(theme.sunDusk),
    sun.warmth
  )
  const skyColour = new THREE.Color(theme.skyDay).lerp(
    new THREE.Color(theme.skyNight),
    sun.night
  )
  return (
    <>
      <hemisphereLight args={[skyColour, theme.ground, 0.9]} />
      <ambientLight intensity={0.32 + sun.night * 0.1} />
      <directionalLight
        position={sun.position}
        intensity={sun.strength}
        color={sunColour}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0008}
      />
      <Environment resolution={128} frames={1} environmentIntensity={0.35}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 8, -10]}
          scale={[20, 6, 1]}
          color="#dfe7ff"
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[-12, 5, 4]}
          rotation-y={Math.PI / 2}
          scale={[10, 4, 1]}
          color="#ffe6c4"
        />
        <Lightformer
          form="ring"
          intensity={0.8}
          position={[10, 10, 6]}
          scale={6}
          color="#ffffff"
        />
      </Environment>
    </>
  )
}

/* ---------- The city, at the busbar ------------------------------------------------------ */

const CITY = Array.from({ length: 36 }, (_, i) => {
  const gx = (i % 6) - 2.5
  const gz = Math.floor(i / 6) - 2.5
  const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
  return {
    x: gx * 0.46 + (seed - 0.5) * 0.12,
    z: gz * 0.46 + (seed - 0.5) * 0.12,
    h: 0.35 + seed * 1.1 + (Math.abs(gx) + Math.abs(gz) < 2 ? 0.7 : 0),
    w: 0.26 + seed * 0.14,
  }
})

function City({
  demand,
  peak,
  night,
  theme,
}: {
  demand: number
  peak: number
  night: number
  theme: SceneTheme
}) {
  const base = at(BUS)
  const load = demand / peak
  const glow = (0.15 + load * 0.85) * (0.35 + night * 0.65)
  return (
    <group position={base}>
      {CITY.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial
            color={theme.node}
            emissive={theme.city}
            emissiveIntensity={glow * (0.5 + ((i * 7) % 5) / 8)}
            roughness={0.6}
          />
        </mesh>
      ))}
      <pointLight
        position={[0, 1.6, 0]}
        color={theme.city}
        intensity={glow * 14}
        distance={9}
        decay={2}
      />
    </group>
  )
}

/* ---------- Plants -------------------------------------------------------------------- */

const sizeOf = (unit: Unit) => 0.4 + Math.sqrt(unit.capacity) / 40

function Blades({ speed }: { speed: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z -= delta * speed
  })
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation-z={(i * Math.PI * 2) / 3} position-y={0}>
          <boxGeometry args={[0.07, 1.25, 0.03]} />
          <meshStandardMaterial color="#f4f6fa" roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Plant({
  unit,
  out,
  colour,
  offline,
  onToggle,
  theme,
}: {
  unit: Unit
  out: UnitOutput
  colour: string
  offline: boolean
  onToggle: () => void
  theme: SceneTheme
}) {
  const p = at(UNIT_AT[unit.id])
  const s = sizeOf(unit)
  const load = out.available > 0 ? out.mw / out.available : 0
  const emissive = offline ? 0 : 0.12 + load * 1.1
  const material = (
    <meshStandardMaterial
      color={offline ? theme.cell : colour}
      emissive={colour}
      emissiveIntensity={emissive}
      roughness={0.45}
      metalness={0.1}
      wireframe={offline}
    />
  )

  let body: React.ReactNode
  switch (unit.fuel) {
    case "wind":
      body = (
        <>
          <mesh position-y={s * 1.1} castShadow>
            <cylinderGeometry args={[0.05, 0.09, s * 2.2, 10]} />
            {material}
          </mesh>
          <group position={[0, s * 2.2, 0.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.16, 0.3]} />
              {material}
            </mesh>
            <group position-z={0.2}>
              <Blades speed={offline ? 0 : 0.6 + load * 5} />
            </group>
          </group>
        </>
      )
      break
    case "solar":
      body = (
        <group>
          {[-0.7, 0, 0.7].map((dx) => (
            <mesh
              key={dx}
              position={[dx, 0.3, 0]}
              rotation-x={-0.55}
              castShadow
            >
              <boxGeometry args={[0.6, 0.04, 1.1]} />
              {material}
            </mesh>
          ))}
        </group>
      )
      break
    case "nuclear":
      body = (
        <>
          <mesh position-y={s * 0.45} castShadow>
            <cylinderGeometry args={[s * 0.75, s * 0.8, s * 0.9, 24]} />
            {material}
          </mesh>
          <mesh position-y={s * 0.9} castShadow>
            <sphereGeometry
              args={[s * 0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            {material}
          </mesh>
          <mesh position={[s * 1.2, s * 0.55, s * 0.4]} castShadow>
            <boxGeometry args={[s * 0.9, s * 1.1, s * 0.7]} />
            {material}
          </mesh>
        </>
      )
      break
    case "gas":
      body = (
        <>
          <mesh position-y={s * 0.4} castShadow>
            <boxGeometry args={[s * 1.4, s * 0.8, s * 0.9]} />
            {material}
          </mesh>
          {[-0.35, 0.35].map((dx) => (
            <mesh key={dx} position={[dx * s, s * 1.3, -s * 0.2]} castShadow>
              <cylinderGeometry args={[0.09, 0.12, s * 1.8, 12]} />
              {material}
            </mesh>
          ))}
        </>
      )
      break
    case "biomass":
      body = (
        <>
          <mesh position-y={s * 0.45} castShadow>
            <boxGeometry args={[s * 1.1, s * 0.9, s * 0.8]} />
            {material}
          </mesh>
          <mesh position={[s * 0.35, s * 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, s * 1.4, 12]} />
            {material}
          </mesh>
        </>
      )
      break
    case "hydro":
      body = (
        <mesh position-y={s * 0.35} rotation-y={0.5} castShadow>
          <boxGeometry args={[s * 2.4, s * 0.7, s * 0.35]} />
          {material}
        </mesh>
      )
      break
    default:
      body = (
        <group>
          {[-0.3, 0.3].map((dx) => (
            <mesh key={dx} position={[dx, 0.3, 0]} castShadow>
              <boxGeometry args={[0.5, 0.6, 0.9]} />
              {material}
            </mesh>
          ))}
        </group>
      )
  }

  const height =
    unit.fuel === "wind" ? s * 2.2 + 1.3 : unit.fuel === "solar" ? 0.9 : s * 1.9

  return (
    <group position={p}>
      <group onClick={(e) => (e.stopPropagation(), onToggle())}>
        {body}
        {/* A pad under every plant: the hit target, and where the label hangs from. */}
        <mesh position-y={0.03} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[Math.max(1.1, s * 1.4), 32]} />
          <meshStandardMaterial
            color={theme.cell}
            transparent
            opacity={0.55}
            roughness={1}
          />
        </mesh>
      </group>
      <Html
        position={[0, height + 0.35, 0]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "auto" }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={offline}
          aria-label={`${unit.name}, ${Math.round(out.mw)} of ${unit.capacity} megawatts${offline ? ", offline" : ""}`}
          className="glass hidden items-baseline gap-1.5 rounded-full px-2.5 py-1 figure text-[11px] leading-none whitespace-nowrap text-foreground select-none hover:border-ring/60 focus-visible:outline-2 focus-visible:outline-ring sm:flex"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: colour, opacity: offline ? 0.3 : 1 }}
          />
          <span className={offline ? "line-through opacity-60" : ""}>
            {unit.name}
          </span>
          <span className="text-muted-foreground">{Math.round(out.mw)}</span>
        </button>
      </Html>
    </group>
  )
}

/* ---------- Nodes and the link ---------------------------------------------------------- */

function Node({
  id,
  mw,
  capacity,
  theme,
}: {
  id: NodeId
  mw: number
  capacity: number
  theme: SceneTheme
}) {
  const p = at(NODE_AT[id])
  const load = capacity > 0 ? mw / capacity : 0
  return (
    <group position={p}>
      <mesh position-y={0.06} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.72, 40]} />
        <meshStandardMaterial
          color={theme.node}
          emissive={theme.node}
          emissiveIntensity={0.15 + load * 0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position-y={0.7} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 8]} />
        <meshStandardMaterial color={theme.node} roughness={0.4} />
      </mesh>
      <Html position={[0, 1.75, 0]} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none label whitespace-nowrap text-foreground/90">
          {NODES[id].name} · {Math.round(mw).toLocaleString("en-GB")}
        </span>
      </Html>
    </group>
  )
}

function Pylon({
  theme,
  importing,
  mw,
}: {
  theme: SceneTheme
  importing: boolean
  mw: number
}) {
  const p = at(LINK_AT)
  return (
    <group position={p}>
      <mesh position-y={1.3} castShadow>
        <cylinderGeometry args={[0.04, 0.12, 2.6, 4]} />
        <meshStandardMaterial color={theme.node} roughness={0.5} />
      </mesh>
      <mesh position-y={2.2} rotation-y={Math.PI / 4}>
        <boxGeometry args={[1.6, 0.06, 0.06]} />
        <meshStandardMaterial color={theme.node} />
      </mesh>
      <Html position={[0, 3, 0]} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none label whitespace-nowrap text-foreground/90">
          {INTERCONNECTOR.name} · {importing ? "↓" : "↑"}{" "}
          {Math.round(mw).toLocaleString("en-GB")}
        </span>
      </Html>
    </group>
  )
}

/* ---------- Power, moving ------------------------------------------------------------- */

type Flow = {
  curve: THREE.CatmullRomCurve3
  mw: number
  load: number
  colour: THREE.Color
}

const MAX_PARTICLES = 720
const PER_FLOW = (mw: number) => Math.min(48, Math.ceil(mw / 55))

function arc(
  from: [number, number, number],
  to: [number, number, number],
  rise: number
) {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    Math.max(from[1], to[1]) + rise,
    (from[2] + to[2]) / 2,
  ]
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    ],
    false,
    "catmullrom",
    0.6
  )
}

function buildFlows(
  now: Period,
  fuelHex: Record<Series, string>,
  theme: SceneTheme
): Flow[] {
  const flows: Flow[] = []
  const nodeTotal = new Map<NodeId, { mw: number; capacity: number }>()

  for (const out of now.outputs) {
    const node = out.unit.node as NodeId
    const t = nodeTotal.get(node) ?? { mw: 0, capacity: 0 }
    nodeTotal.set(node, {
      mw: t.mw + out.mw,
      capacity: t.capacity + out.unit.capacity,
    })
    if (out.mw <= 0.5) continue
    flows.push({
      curve: arc(
        lift(at(UNIT_AT[out.unit.id]), 0.5),
        lift(at(NODE_AT[node]), 0.9),
        1.1
      ),
      mw: out.mw,
      load: out.available > 0 ? out.mw / out.available : 0,
      colour: new THREE.Color(fuelHex[out.unit.fuel as Series]),
    })
  }

  for (const [node, t] of nodeTotal) {
    if (t.mw <= 0.5) continue
    flows.push({
      curve: arc(lift(at(NODE_AT[node]), 0.9), lift(at(BUS), 1.2), 2.0),
      mw: t.mw,
      load: t.capacity > 0 ? t.mw / t.capacity : 0,
      colour: new THREE.Color(theme.node),
    })
  }

  const link = now.interconnector
  if (Math.abs(link) > 0.5) {
    const pylon = lift(at(LINK_AT), 2.1)
    const away = lift(at(LINK_AWAY), 2.4)
    const bus = lift(at(BUS), 1.2)
    const colour = new THREE.Color(fuelHex.import)
    const load = Math.abs(link) / INTERCONNECTOR.capacity
    flows.push(
      link > 0
        ? { curve: arc(away, pylon, 0.3), mw: link, load, colour }
        : { curve: arc(pylon, away, 0.3), mw: -link, load, colour },
      link > 0
        ? { curve: arc(pylon, bus, 2.2), mw: link, load, colour }
        : { curve: arc(bus, pylon, 2.2), mw: -link, load, colour }
    )
  }
  return flows
}

function Flows({ flows, theme }: { flows: Flow[]; theme: SceneTheme }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const clock = useRef(0)

  // Per-flow particle offsets, stable across frames so a change of load does not reshuffle.
  const plan = useMemo(() => {
    const out: { flow: Flow; start: number; n: number }[] = []
    let start = 0
    for (const flow of flows) {
      const n = Math.max(0, Math.min(PER_FLOW(flow.mw), MAX_PARTICLES - start))
      out.push({ flow, start, n })
      start += n
    }
    return out
  }, [flows])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    for (const { flow, start, n } of plan) {
      for (let i = 0; i < n; i++) m.setColorAt(start + i, flow.colour)
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [plan])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    clock.current += delta
    let used = 0
    for (const { flow, start, n } of plan) {
      const speed = 0.12 + flow.load * 0.55 // curve lengths per second
      const size = 0.035 + flow.load * 0.03
      for (let i = 0; i < n; i++) {
        const t = (clock.current * speed + i / n) % 1
        const p = flow.curve.getPointAt(t)
        dummy.position.copy(p)
        dummy.scale.setScalar(size)
        dummy.updateMatrix()
        m.setMatrixAt(start + i, dummy.matrix)
      }
      used = start + n
    }
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    for (let i = used; i < MAX_PARTICLES; i++) m.setMatrixAt(i, dummy.matrix)
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {flows.map((flow, i) => (
        <Line
          key={i}
          points={flow.curve.getPoints(32)}
          color={theme.track}
          lineWidth={1}
          transparent
          opacity={0.55}
        />
      ))}
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial
          emissive="#ffffff"
          emissiveIntensity={0.9}
          toneMapped={false}
          roughness={0.3}
        />
      </instancedMesh>
    </>
  )
}

/* ---------- Scene --------------------------------------------------------------------- */

function Region() {
  const { now, offline, toggle, period, periods } = useGrid()
  const theme = useSceneTheme()
  const fuelHex = useFuelHex()
  const reduced = useReducedMotion()

  const peakDemand = Math.max(...periods.map((p) => p.demand))
  const flows = useMemo(
    () => buildFlows(now, fuelHex, theme),
    [now, fuelHex, theme]
  )
  const sun = sunFor(period)

  const nodeTotals = (Object.keys(NODES) as NodeId[]).map((id) => {
    const units = UNITS.filter((u) => u.node === id)
    const mw = now.outputs
      .filter((o) => o.unit.node === id)
      .reduce((s, o) => s + o.mw, 0)
    return { id, mw, capacity: units.reduce((s, u) => s + u.capacity, 0) }
  })

  return (
    <>
      <fog attach="fog" args={[theme.fog, 24, 54]} />
      <Sky period={period} theme={theme} />
      <Terrain theme={theme} />
      <City
        demand={now.demand}
        peak={peakDemand}
        night={sun.night}
        theme={theme}
      />

      {nodeTotals.map((n) => (
        <Node
          key={n.id}
          id={n.id}
          mw={n.mw}
          capacity={n.capacity}
          theme={theme}
        />
      ))}

      {now.outputs.map((out) => (
        <Plant
          key={out.unit.id}
          unit={out.unit}
          out={out}
          colour={fuelHex[out.unit.fuel as Series]}
          offline={offline.includes(out.unit.id)}
          onToggle={() => toggle(out.unit.id)}
          theme={theme}
        />
      ))}

      <Pylon
        theme={theme}
        importing={now.interconnector >= 0}
        mw={Math.abs(now.interconnector)}
      />
      <Flows flows={flows} theme={theme} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={14}
        maxDistance={60}
        minPolarAngle={0.35}
        maxPolarAngle={1.22}
        autoRotate={!reduced}
        autoRotateSpeed={0.3}
        target={[0.6, 0.3, 2.4]}
      />
    </>
  )
}

/**
 * A camera that knows the shape of its viewport. A phone's portrait frame shows a third of the
 * width a desktop does at the same distance, so the rig pulls back and widens the lens.
 */
function CameraRig() {
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  const portrait = aspect < 0.9
  const fov = portrait ? 50 : aspect < 1.4 ? 42 : 36
  const d = portrait ? 31 : aspect < 1.4 ? 33 : 30
  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      near={0.5}
      far={160}
      position={portrait ? [1.5, d * 0.8, d * 0.6] : [2.5, d * 0.56, d * 0.84]}
    />
  )
}

const HAS_WEBGL = (() => {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
})()

export function RegionScene({ fallback }: { fallback: React.ReactNode }) {
  const { now } = useGrid()
  if (!HAS_WEBGL) return <>{fallback}</>

  return (
    <div
      className="absolute inset-0"
      role="img"
      aria-label={`The region in three dimensions. Demand ${Math.round(now.demand)} megawatts; plants lit by their output, power moving along the lines to the city.`}
    >
      <Canvas
        dpr={[1, 1.6]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ touchAction: "pan-y" }}
      >
        <CameraRig />
        <Region />
      </Canvas>
    </div>
  )
}
