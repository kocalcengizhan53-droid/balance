import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { CITY_AT, CITY_SIZE } from "@/features/scene/layout"
import type { SceneTheme } from "@/features/scene/palette"

/**
 * The city at the busbar: a block of towers in the structure material, with bands of windows
 * that light up after dark and burn brighter the more the city is drawing. Two instanced
 * meshes, however many towers.
 */

const N = 6
const TOWERS = Array.from({ length: N * N }, (_, i) => {
  const gx = (i % N) - (N - 1) / 2
  const gz = Math.floor(i / N) - (N - 1) / 2
  const seed = Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1
  const centre = 1 - Math.min(1, Math.hypot(gx, gz) / 3.6)
  const step = CITY_SIZE / N
  return {
    x: CITY_AT[0] + gx * step,
    z: CITY_AT[1] + gz * step,
    w: step * (0.62 + seed * 0.18),
    h: 0.3 + seed * 0.7 + centre * centre * 2.1,
  }
})
const BANDS = TOWERS.flatMap((t, i) =>
  Array.from({ length: Math.max(1, Math.floor(t.h / 0.45)) }, (_, k) => ({
    ...t,
    y: 0.25 + k * 0.42,
    lit: (i * 7 + k * 3) % 5 !== 0,
  }))
).filter((b) => b.lit && b.y < b.h - 0.12)

export function City({
  structure,
  load,
  night,
  theme,
}: {
  structure: THREE.Material
  load: number
  night: number
  theme: SceneTheme
}) {
  const towers = useRef<THREE.InstancedMesh>(null)
  const bands = useRef<THREE.InstancedMesh>(null)
  const windows = useMemo(
    () => new THREE.MeshStandardMaterial({ toneMapped: false, roughness: 0.6 }),
    []
  )
  useLayoutEffect(() => {
    windows.color.set(theme.window).multiplyScalar(0.25 + night * 0.75)
    windows.emissive.set(theme.window)
    windows.emissiveIntensity = (0.08 + night * 1.6) * (0.4 + load * 0.6)
  }, [windows, theme, night, load])

  useEffect(() => {
    const o = new THREE.Object3D()
    TOWERS.forEach((t, i) => {
      o.position.set(t.x, t.h / 2, t.z)
      o.scale.set(t.w, t.h, t.w)
      o.updateMatrix()
      towers.current?.setMatrixAt(i, o.matrix)
    })
    BANDS.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z)
      o.scale.set(b.w + 0.012, 0.07, b.w + 0.012)
      o.updateMatrix()
      bands.current?.setMatrixAt(i, o.matrix)
    })
    if (towers.current) towers.current.instanceMatrix.needsUpdate = true
    if (bands.current) bands.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      <instancedMesh
        ref={towers}
        args={[undefined, undefined, TOWERS.length]}
        material={structure}
        castShadow
        receiveShadow
      >
        <boxGeometry />
      </instancedMesh>
      <instancedMesh
        ref={bands}
        args={[undefined, undefined, BANDS.length]}
        material={windows}
      >
        <boxGeometry />
      </instancedMesh>
    </group>
  )
}
