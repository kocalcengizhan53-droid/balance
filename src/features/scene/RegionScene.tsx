import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, OrthographicCamera } from "@react-three/drei"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { useReducedMotion } from "motion/react"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"

import { useGrid } from "@/features/dashboard/useGrid"
import { Board } from "@/features/scene/Board"
import { Cables, Pylons } from "@/features/scene/Cables"
import { buildCables } from "@/features/scene/routing"
import { City } from "@/features/scene/City"
import { daylight } from "@/features/scene/daylight"
import { Projector, SceneLabels, type LabelSpec } from "@/features/scene/Labels"
import {
  LINK_FAR,
  NODE_AT,
  ON_PLATEAU,
  PLATEAU,
  UNIT_AT,
} from "@/features/scene/layout"
import {
  useDark,
  useFuelHex,
  useSceneTheme,
  type SceneTheme,
} from "@/features/scene/palette"
import { useMaterials, type Materials } from "@/features/scene/materials"
import { Plant } from "@/features/scene/Plants"
import { INTERCONNECTOR, NODES, type NodeId, type Unit } from "@/lib/grid/units"
import type { Series } from "@/lib/viz/fuel"

/**
 * The region, as a model on a table.
 *
 * Everything above this on the page is an instrument; this is the thing the instruments are
 * reading, seen from one fixed, isometric angle so it composes like an illustration rather
 * than a game level. Plants glow with their load, light runs along the cables at the rate the
 * solver says power does, and the clock sets the light: the solar farm comes alive at nine and
 * the city's windows come up at dusk. Press a plant to take it out of service and watch where
 * the power comes from instead.
 *
 * Nothing is fetched: geometry is built in code, the colours come from the page's stylesheet.
 */

const TARGET = new THREE.Vector3(1.1, 0.4, 0)
// Seen from the south-west, so the far corner is the strait, top right, and the top left of the
// stage stays clear for the page title.
const AZIMUTH = -0.55
const POLAR = 0.98

/** Where each plant's label hangs: above whatever its body is. */
function labelHeight(unit: Unit) {
  const base = ON_PLATEAU.has(unit.id) ? PLATEAU.height : 0
  const body =
    { wind: 3.1, nuclear: 2.9, gas: 2.4, biomass: 1.8, hydro: 1.3, solar: 0.9 }[
      unit.fuel as string
    ] ?? 0.9
  return base + body
}

function Substation({
  id,
  load,
  materials,
  theme,
}: {
  id: NodeId
  load: number
  materials: Materials
  theme: SceneTheme
}) {
  const [x, z] = NODE_AT[id]
  return (
    <group position={[x, 0, z]}>
      <mesh
        position-y={0.01}
        rotation-x={-Math.PI / 2}
        material={materials.pad}
        receiveShadow
      >
        <circleGeometry args={[0.75, 32]} />
      </mesh>
      <mesh position-y={0.025} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.62, 0.72, 40]} />
        <meshStandardMaterial
          color={theme.structure}
          emissive={theme.structure}
          emissiveIntensity={0.1 + load * 0.9}
          toneMapped={false}
        />
      </mesh>
      {[-0.2, 0.2].map((dx) => (
        <mesh
          key={dx}
          position={[dx, 0.2, 0]}
          material={materials.structure}
          castShadow
        >
          <boxGeometry args={[0.24, 0.4, 0.36]} />
        </mesh>
      ))}
    </group>
  )
}

function Lights({
  period,
  theme,
  dark,
}: {
  period: number
  theme: SceneTheme
  dark: boolean
}) {
  const d = daylight(period)
  // A pale board under the same lamp as a dark one would burn out to white.
  const k = dark ? 1 : 0.55
  const key = new THREE.Color(theme.keyDay).lerp(
    new THREE.Color(theme.keyDusk),
    d.warmth
  )
  key.lerp(new THREE.Color(theme.keyNight), d.night * 0.9)
  const sky = new THREE.Color(theme.skyDay).lerp(
    new THREE.Color(theme.skyNight),
    d.night
  )
  return (
    <>
      <hemisphereLight args={[sky, theme.side, (1.3 + d.day * 0.5) * k]} />
      <ambientLight intensity={0.45 * k} />
      <directionalLight
        position={[-15, 20, 4]}
        intensity={(1.9 + d.day * 1.5) * (1 - d.night * 0.45) * k}
        color={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </>
  )
}

/**
 * How the board sits in the canvas: zoomed to fit what is left of it once the instruments
 * overlap its foot on a wide screen, and nudged right, clear of the page title, so the region
 * is framed rather than centred. Shifts are in pixels, turned into a move of the target along
 * the camera's own right and up.
 */
function useFraming() {
  const size = useThree((s) => s.size)
  const wide = size.width >= 900
  const inset = wide ? 96 : 0
  const zoom = Math.min(size.width / 33, (size.height - inset) / 18.5)
  const right = wide ? size.width * 0.04 : 0
  const up = inset / 2
  const elevation = Math.PI / 2 - POLAR
  const target = TARGET.clone()
    .add(
      new THREE.Vector3(
        Math.cos(AZIMUTH),
        0,
        -Math.sin(AZIMUTH)
      ).multiplyScalar(-right / zoom)
    )
    .add(
      new THREE.Vector3(Math.sin(AZIMUTH), 0, Math.cos(AZIMUTH)).multiplyScalar(
        up / (zoom * Math.sin(elevation))
      )
    )
  return { zoom, target }
}

/** An orthographic camera at the board's fixed isometric angle. */
function Camera() {
  const { zoom, target } = useFraming()
  const r = 60
  const position: [number, number, number] = [
    target.x + r * Math.sin(POLAR) * Math.sin(AZIMUTH),
    target.y + r * Math.cos(POLAR),
    target.z + r * Math.sin(POLAR) * Math.cos(AZIMUTH),
  ]
  return (
    <OrthographicCamera
      makeDefault
      position={position}
      zoom={zoom}
      near={1}
      far={200}
    />
  )
}

/**
 * A slow sway about the board while nobody is touching it, so the scene is never a still. It
 * sways about wherever the visitor left it, starting three seconds after they let go.
 */
function Controls({ reduced }: { reduced: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const sway = useRef({ base: AZIMUTH, since: 0, touching: false })
  const clock = useThree((s) => s.clock)
  const { zoom: fit, target } = useFraming()
  useFrame(() => {
    const c = controls.current
    const s = sway.current
    if (!c || reduced || s.touching) return
    const t = clock.elapsedTime - s.since - 3
    if (t > 0) c.setAzimuthalAngle(s.base + Math.sin(t * 0.11) * 0.16)
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={target}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minZoom={fit * 0.85}
      maxZoom={fit * 2.6}
      minPolarAngle={0.7}
      maxPolarAngle={1.15}
      minAzimuthAngle={AZIMUTH - 0.75}
      maxAzimuthAngle={AZIMUTH + 0.75}
      onStart={() => (sway.current.touching = true)}
      onEnd={() => {
        const c = controls.current
        sway.current = {
          base: c ? c.getAzimuthalAngle() : AZIMUTH,
          since: clock.elapsedTime,
          touching: false,
        }
      }}
    />
  )
}

/** Calls back once the first frames have been drawn, so the page can swap the poster out. */
function Ready({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current === 3) onReady?.()
  })
  return null
}

function Region({
  hovered,
  setHovered,
}: {
  hovered: string | null
  setHovered: (id: string | null) => void
}) {
  const { now, offline, toggle, period, periods } = useGrid()
  const theme = useSceneTheme()
  const fuelHex = useFuelHex()
  const materials = useMaterials(theme)
  const dark = useDark()
  const reduced = useReducedMotion() ?? false
  const d = daylight(period)
  const peak = Math.max(...periods.map((p) => p.demand))
  const cables = useMemo(
    () => buildCables(now, fuelHex, theme.structure),
    [now, fuelHex, theme.structure]
  )

  const nodeLoad = (id: NodeId) => {
    const outs = now.outputs.filter((o) => o.unit.node === id)
    const cap = outs.reduce((s, o) => s + o.unit.capacity, 0)
    return cap > 0 ? outs.reduce((s, o) => s + Math.max(0, o.mw), 0) / cap : 0
  }

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : ""
    return () => void (document.body.style.cursor = "")
  }, [hovered])

  return (
    <>
      <Lights period={period} theme={theme} dark={dark} />
      <Board theme={theme} />
      <City
        structure={materials.structure}
        load={now.demand / peak}
        night={d.night}
        theme={theme}
      />
      {(Object.keys(NODES) as NodeId[]).map((id) => (
        <Substation
          key={id}
          id={id}
          load={nodeLoad(id)}
          materials={materials}
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
          hovered={hovered === out.unit.id}
          materials={materials}
          glow={dark ? 1 : 0.35}
          onToggle={() => toggle(out.unit.id)}
          onHover={(on) => setHovered(on ? out.unit.id : null)}
        />
      ))}
      <Pylons material={materials.structure} />
      <Cables cables={cables} theme={theme} boost={dark ? 2.2 : 1} />
      <Controls reduced={reduced} />
    </>
  )
}

declare global {
  interface Window {
    /** Present only with `?capture`: lets the video script set the half-hour and step the clock. */
    __scene?: {
      setPeriod: (period: number) => void
      step: (seconds: number) => void
    }
  }
}

/** Under `?capture` the scene draws only when stepped, so every frame is exactly one frame apart. */
function CaptureClock() {
  const advance = useThree((state) => state.advance)
  const { setPeriod } = useGrid()
  useEffect(() => {
    let t = performance.now()
    window.__scene = {
      setPeriod,
      step: (seconds) => {
        t += seconds * 1000
        advance(t)
      },
    }
    return () => {
      delete window.__scene
    }
  }, [advance, setPeriod])
  return null
}

export function RegionScene({
  onReady,
  capture = false,
}: {
  onReady?: () => void
  capture?: boolean
}) {
  const { now, offline, toggle } = useGrid()
  const dark = useDark()
  const fuelHex = useFuelHex()
  const [hovered, setHovered] = useState<string | null>(null)
  const labelRefs = useRef(
    new Map<string, { at: THREE.Vector3; el: HTMLElement | null }>()
  )

  const labels: LabelSpec[] = [
    ...now.outputs.map((out) => {
      const unit = out.unit
      const isOff = offline.includes(unit.id)
      const [x, z] = UNIT_AT[unit.id]
      return {
        id: `u-${unit.id}`,
        at: [x, labelHeight(unit), z] as [number, number, number],
        node: (
          <button
            type="button"
            onClick={() => toggle(unit.id)}
            onPointerEnter={() => setHovered(unit.id)}
            onPointerLeave={() => setHovered(null)}
            aria-pressed={isOff}
            aria-label={`${unit.name}, ${Math.round(out.mw)} of ${unit.capacity} megawatts${isOff ? ", offline" : ""}`}
            className={`pointer-events-auto glass hidden items-baseline gap-1.5 rounded-full px-2 py-1 figure text-[10.5px] leading-none whitespace-nowrap text-foreground transition-[border-color,transform] select-none hover:border-ring/70 focus-visible:outline-2 focus-visible:outline-ring sm:flex ${hovered === unit.id ? "scale-110 border-ring/70" : ""}`}
          >
            <span
              aria-hidden="true"
              className="inline-block size-1.5 rounded-full"
              style={{
                backgroundColor: fuelHex[unit.fuel as Series],
                opacity: isOff ? 0.3 : 1,
              }}
            />
            <span className={isOff ? "line-through opacity-60" : ""}>
              {unit.name}
            </span>
            <span className="text-muted-foreground">{Math.round(out.mw)}</span>
          </button>
        ),
      }
    }),
    {
      id: "link",
      at: [LINK_FAR[0], 3.0, LINK_FAR[1]],
      node: (
        <span className="label whitespace-nowrap text-foreground/80">
          {INTERCONNECTOR.name} ·{" "}
          {now.interconnector >= 0 ? "importing" : "exporting"}{" "}
          {Math.abs(Math.round(now.interconnector)).toLocaleString("en-GB")}
        </span>
      ),
    },
  ]

  return (
    <div className="absolute inset-0">
      <p className="sr-only">
        The region as a model: plants glow with their output and light moves
        along the cables to the city. Demand is{" "}
        {Math.round(now.demand).toLocaleString("en-GB")} megawatts. Each plant's
        label below takes it out of service.
      </p>
      <Canvas
        aria-hidden="true"
        frameloop={capture ? "never" : "always"}
        dpr={[1, 1.6]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ touchAction: "pan-y" }}
        onPointerMissed={() => setHovered(null)}
      >
        <Camera />
        <Region hovered={hovered} setHovered={setHovered} />
        <Projector refs={labelRefs} />
        {/*
         * Only what is brighter than white blooms: the accents and the pulses, which are drawn
         * unclamped. The structure and the board stay crisp.
         */}
        {dark ? (
          <EffectComposer multisampling={4}>
            <Bloom
              mipmapBlur
              luminanceThreshold={1}
              luminanceSmoothing={0.2}
              intensity={0.9}
              radius={0.6}
            />
          </EffectComposer>
        ) : null}
        <Ready onReady={onReady} />
        {capture ? <CaptureClock /> : null}
      </Canvas>
      <SceneLabels
        labels={labels}
        refs={labelRefs}
        name="Plants in the region"
      />
    </div>
  )
}
