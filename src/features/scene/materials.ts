import { useLayoutEffect, useMemo } from "react"
import * as THREE from "three"

import type { SceneTheme } from "@/features/scene/palette"

/**
 * The few materials every model on the board shares: one structure, its out-of-service ghost,
 * the pads plants stand on, and the steam. Created once; recoloured when the theme changes.
 */
export type Materials = {
  structure: THREE.MeshStandardMaterial
  ghost: THREE.MeshStandardMaterial
  pad: THREE.MeshStandardMaterial
  padHot: THREE.MeshStandardMaterial
  steam: THREE.MeshStandardMaterial
}

export function useMaterials(theme: SceneTheme): Materials {
  const m = useMemo<Materials>(
    () => ({
      structure: new THREE.MeshStandardMaterial({ roughness: 0.72 }),
      ghost: new THREE.MeshStandardMaterial({
        roughness: 0.9,
        transparent: true,
        opacity: 0.5,
      }),
      pad: new THREE.MeshStandardMaterial({ roughness: 1 }),
      padHot: new THREE.MeshStandardMaterial({ roughness: 1 }),
      steam: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1,
        transparent: true,
        depthWrite: false,
      }),
    }),
    []
  )
  useLayoutEffect(() => {
    m.structure.color.set(theme.structure)
    m.ghost.color.set(theme.ghost)
    m.pad.color.set(theme.pad)
    m.padHot.color.set(theme.track)
  }, [m, theme])
  return m
}
