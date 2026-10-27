import { useLayoutEffect, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  BOARD,
  FAR_SHORE,
  PLATEAU,
  RESERVOIR,
  STRAIT,
} from "@/features/scene/layout"
import type { SceneTheme } from "@/features/scene/palette"

/**
 * The board the region stands on: a bevelled slab with the plateau raised on it, the reservoir
 * on the plateau, and the strait cut along the east with the far shore beyond. Every piece is
 * one rounded rectangle extruded, so the edges all catch the light the same way.
 */

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

/** A rounded rectangle in the xz plane, extruded upward from `bottom` to `top`. */
function slab(
  r: Rect,
  bottom: number,
  top: number,
  radius: number,
  bevel = 0.1
) {
  const s = new THREE.Shape()
  const [x0, x1, z0, z1] = [r.minX, r.maxX, r.minZ, r.maxZ]
  const k = Math.min(radius, (x1 - x0) / 2, (z1 - z0) / 2)
  // Shape y is −z, so the shape lies the right way round after the rotation below.
  s.moveTo(x0 + k, -z0)
  s.lineTo(x1 - k, -z0)
  s.quadraticCurveTo(x1, -z0, x1, -z0 - k)
  s.lineTo(x1, -z1 + k)
  s.quadraticCurveTo(x1, -z1, x1 - k, -z1)
  s.lineTo(x0 + k, -z1)
  s.quadraticCurveTo(x0, -z1, x0, -z1 + k)
  s.lineTo(x0, -z0 - k)
  s.quadraticCurveTo(x0, -z0, x0 + k, -z0)
  const depth = Math.max(0.01, top - bottom - bevel * 2)
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bottom + bevel, 0)
  return g
}

const WATER_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  varying vec3 vWorld;
  void main() {
    float a = sin(vWorld.z * 1.6 + uTime * 0.7 + sin(vWorld.x * 2.1 + uTime * 0.4) * 1.3);
    float b = sin(vWorld.z * 3.7 - uTime * 1.1 + vWorld.x * 1.3);
    float glint = smoothstep(0.82, 1.0, a * 0.6 + b * 0.4);
    vec3 c = mix(uDeep, uShallow, 0.35 + a * 0.12) + glint * 0.18;
    gl_FragColor = vec4(c, 0.94);
    #include <colorspace_fragment>
  }
`

function Water({
  rect,
  y,
  theme,
}: {
  rect: Rect
  y: number
  theme: SceneTheme
}) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color() },
    }),
    []
  )
  useLayoutEffect(() => {
    uniforms.uDeep.value.set(theme.waterDeep)
    uniforms.uShallow.value.set(theme.waterShallow)
  }, [uniforms, theme])
  useFrame((_, delta) => {
    uniforms.uTime.value += delta
  })
  const w = rect.maxX - rect.minX
  const d = rect.maxZ - rect.minZ
  return (
    <mesh
      position={[(rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2]}
      rotation-x={-Math.PI / 2}
      receiveShadow
    >
      <planeGeometry args={[w, d]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        transparent
      />
    </mesh>
  )
}

/** A hairline of light around the top edge, the way a model's bevel catches a lamp. */
function Rim({ rect, y, colour }: { rect: Rect; y: number; colour: string }) {
  const geometry = useMemo(() => {
    const k = 1.1
    const s = new THREE.Shape()
    const [x0, x1, z0, z1] = [rect.minX, rect.maxX, rect.minZ, rect.maxZ]
    s.moveTo(x0 + k, z0)
    s.lineTo(x1 - k, z0)
    s.quadraticCurveTo(x1, z0, x1, z0 + k)
    s.lineTo(x1, z1 - k)
    s.quadraticCurveTo(x1, z1, x1 - k, z1)
    s.lineTo(x0 + k, z1)
    s.quadraticCurveTo(x0, z1, x0, z1 - k)
    s.lineTo(x0, z0 + k)
    s.quadraticCurveTo(x0, z0, x0 + k, z0)
    const pts = s.getPoints(12).map((p) => new THREE.Vector3(p.x, y, p.y))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [rect, y])
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={colour} transparent opacity={0.55} />
    </lineLoop>
  )
}

export function Board({ theme }: { theme: SceneTheme }) {
  const geometry = useMemo(
    () => ({
      board: slab(BOARD, -BOARD.thickness, 0, BOARD.radius, 0.14),
      plateau: slab(PLATEAU, -0.05, PLATEAU.height, 0.9, 0.08),
      seabed: slab(
        {
          minX: STRAIT.minX - 0.6,
          maxX: FAR_SHORE.maxX + 0.4,
          minZ: STRAIT.minZ,
          maxZ: STRAIT.maxZ,
        },
        -BOARD.thickness,
        -0.5,
        BOARD.radius,
        0.12
      ),
      shore: slab(FAR_SHORE, -0.55, 0, 0.6, 0.08),
    }),
    []
  )
  const top = (
    <meshStandardMaterial
      attach="material-0"
      color={theme.top}
      roughness={0.92}
    />
  )
  const side = (
    <meshStandardMaterial
      attach="material-1"
      color={theme.side}
      roughness={0.9}
    />
  )

  return (
    <group>
      <mesh geometry={geometry.board} receiveShadow castShadow>
        {top}
        {side}
      </mesh>
      <mesh geometry={geometry.plateau} receiveShadow castShadow>
        <meshStandardMaterial
          attach="material-0"
          color={theme.plateau}
          roughness={0.9}
        />
        {side}
      </mesh>
      <mesh geometry={geometry.seabed} receiveShadow>
        <meshStandardMaterial
          attach="material-0"
          color={theme.side}
          roughness={1}
        />
        {side}
      </mesh>
      <mesh geometry={geometry.shore} receiveShadow castShadow>
        {top}
        {side}
      </mesh>
      <Water
        rect={{
          minX: STRAIT.minX - 0.4,
          maxX: FAR_SHORE.maxX + 0.3,
          minZ: STRAIT.minZ + 0.1,
          maxZ: STRAIT.maxZ - 0.1,
        }}
        y={-0.18}
        theme={theme}
      />
      <Water rect={RESERVOIR} y={PLATEAU.height + 0.02} theme={theme} />
      <Rim
        rect={{
          minX: BOARD.minX + 0.05,
          maxX: BOARD.maxX - 0.05,
          minZ: BOARD.minZ + 0.05,
          maxZ: BOARD.maxZ - 0.05,
        }}
        y={0.015}
        colour={theme.track}
      />
    </group>
  )
}
