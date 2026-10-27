import { useEffect, useLayoutEffect, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { PYLON_TOP, type Cable } from "@/features/scene/routing"
import { LINK_FAR, LINK_MID, LINK_NEAR } from "@/features/scene/layout"
import type { SceneTheme } from "@/features/scene/palette"

/**
 * Power, moving. Each connection is a cable laid on the board — plant to substation, substation
 * to the city — and the link is an overhead line across the strait. Light runs along every
 * cable in pulses: as many pulses as the megawatts on it call for, as fast as the plant behind
 * it is working, in the colour of what it carries. A plant taken out leaves its cable dark, and
 * the line from the east brightens and quickens because that is what the solver decided.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  uniform float uSpeed;
  uniform float uSpacing;
  uniform float uOn;
  uniform float uGlow;
  uniform float uBoost;
  uniform vec3 uTrack;
  uniform vec3 uPulse;
  varying vec2 vUv;
  void main() {
    float along = vUv.x * uLength;
    float phase = fract((along - uTime * uSpeed) / uSpacing);
    float head = smoothstep(0.0, 0.06, phase) * (1.0 - smoothstep(0.06, 0.42, phase));
    vec3 c = mix(uTrack, uPulse, 0.28 * uOn * uGlow);
    c = mix(c, uPulse * uBoost, head * uOn);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`

function CableMesh({
  cable,
  track,
  boost,
}: {
  cable: Cable
  track: string
  boost: number
}) {
  const length = useMemo(() => cable.curve.getLength(), [cable.curve])
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        cable.curve,
        Math.max(24, Math.ceil(length * 10)),
        cable.radius,
        6,
        false
      ),
    [cable.curve, cable.radius, length]
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  // Each cable starts at its own point in the cycle, so pulses on parallel cables do not march in step.
  const offset = useMemo(
    () =>
      [...cable.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) /
      97,
    [cable.id]
  )
  const uniforms = useMemo(
    () => ({
      uTime: { value: offset },
      uLength: { value: 1 },
      uSpeed: { value: 1 },
      uSpacing: { value: 1 },
      uOn: { value: 0 },
      uGlow: { value: 0 },
      uBoost: { value: 2.2 },
      uTrack: { value: new THREE.Color() },
      uPulse: { value: new THREE.Color() },
    }),
    [offset]
  )
  useLayoutEffect(() => {
    uniforms.uLength.value = length
    uniforms.uSpeed.value = 0.7 + cable.load * 2.6
    uniforms.uSpacing.value = THREE.MathUtils.clamp(
      2.8 - cable.mw / 450,
      0.55,
      2.8
    )
    uniforms.uOn.value = cable.mw > 0.5 ? 1 : 0
    uniforms.uGlow.value = 0.35 + cable.load * 0.65
    uniforms.uBoost.value = boost
    uniforms.uTrack.value.set(track)
    uniforms.uPulse.value.set(cable.colour)
  }, [uniforms, length, cable, track, boost])
  useFrame((_, delta) => {
    uniforms.uTime.value += delta
  })
  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  )
}

export function Cables({
  cables,
  theme,
  boost,
}: {
  cables: Cable[]
  theme: SceneTheme
  /** How far past white a pulse is drawn; past 1 it blooms. */
  boost: number
}) {
  return (
    <group>
      {cables.map((c) => (
        <CableMesh key={c.id} cable={c} track={theme.track} boost={boost} />
      ))}
    </group>
  )
}

/** Lattice pylons for the link: a tapering mast and a cross-arm. */
export function Pylons({ material }: { material: THREE.Material }) {
  return (
    <>
      {[LINK_FAR, LINK_NEAR, LINK_MID].map(([x, z]) => (
        <group key={`${x}`} position={[x, 0, z]} rotation-y={-0.2}>
          <mesh position-y={PYLON_TOP / 2} material={material} castShadow>
            <cylinderGeometry args={[0.05, 0.16, PYLON_TOP, 4]} />
          </mesh>
          <mesh position-y={PYLON_TOP} material={material} castShadow>
            <boxGeometry args={[0.08, 0.06, 1.2]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
