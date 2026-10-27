import { useSyncExternalStore } from "react"

import { FUEL_ORDER, type Series } from "@/lib/viz/fuel"

/**
 * The scene's whole palette, which is the point: one ground, one structure colour, one track
 * colour and the fuel colours as light. Every plant is built from the same matte structure
 * material and carries its fuel only as an emissive accent whose strength is its load, so the
 * scene reads as one model rather than eleven toy colours, and "what is running hard" is the
 * brightest thing in it.
 *
 * The fuel colours live in CSS as validated hex values per theme; three.js can parse hex. The
 * surfaces are OKLCH in CSS, which three cannot, so the scene-only tones are kept here as sRGB
 * stand-ins chosen against the page background they sit on.
 */
export type SceneTheme = {
  top: string
  side: string
  plateau: string
  structure: string
  ghost: string
  track: string
  pad: string
  waterDeep: string
  waterShallow: string
  window: string
  keyDay: string
  keyDusk: string
  keyNight: string
  skyDay: string
  skyNight: string
}

const SCENE: Record<"dark" | "light", SceneTheme> = {
  dark: {
    top: "#232c40",
    side: "#11172a",
    plateau: "#2b354c",
    structure: "#d6dbe5",
    ghost: "#4a5468",
    track: "#3a4762",
    pad: "#283246",
    waterDeep: "#0d2340",
    waterShallow: "#1f5a8f",
    window: "#ffc66b",
    keyDay: "#fff4e0",
    keyDusk: "#ffa463",
    keyNight: "#7d92d6",
    skyDay: "#9db4ff",
    skyNight: "#1b2444",
  },
  light: {
    top: "#d3d9e3",
    side: "#a3adbd",
    plateau: "#dde2ea",
    structure: "#f4f5f8",
    ghost: "#b3bccb",
    track: "#a9b4c5",
    pad: "#c3cbd7",
    waterDeep: "#3f7fc4",
    waterShallow: "#8dbdea",
    window: "#ff9a1f",
    keyDay: "#fff8ec",
    keyDusk: "#ffb878",
    keyNight: "#a7b6e8",
    skyDay: "#dce6ff",
    skyNight: "#7d8cb8",
  },
}

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains("dark")

/** True while the page is in the dark theme; re-renders when the class changes. */
export function useDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => true)
}

export function useSceneTheme(): SceneTheme {
  return SCENE[useDark() ? "dark" : "light"]
}

/** The validated fuel colours, as the page is currently showing them. */
export function useFuelHex(): Record<Series, string> {
  const dark = useDark()
  const style = getComputedStyle(document.documentElement)
  const out = {} as Record<Series, string>
  for (const fuel of FUEL_ORDER) {
    out[fuel] = style.getPropertyValue(`--fuel-${fuel}`).trim() || "#888888"
  }
  // `dark` is read so the colours are re-read when the theme flips, not for its value.
  void dark
  return out
}
