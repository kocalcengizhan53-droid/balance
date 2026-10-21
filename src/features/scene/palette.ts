import { useSyncExternalStore } from "react"

import { FUEL_ORDER, type Series } from "@/lib/viz/fuel"

/**
 * The scene reads its colours from the page, not the other way round.
 *
 * The fuel colours live in CSS as validated hex values per theme; three.js wants them as
 * strings it can parse, which hex is. The surfaces are OKLCH in CSS, which three cannot
 * parse, so the handful of scene-only tones are kept here as sRGB equivalents of the tokens
 * they stand in for — the fog has to match the page background or the terrain's edge shows.
 */
export type SceneTheme = {
  fog: string
  ground: string
  cell: string
  section: string
  track: string
  node: string
  city: string
  skyDay: string
  skyNight: string
  sunDay: string
  sunDusk: string
}

const SCENE: Record<"dark" | "light", SceneTheme> = {
  dark: {
    fog: "#14171e",
    ground: "#232b3a",
    cell: "#2c3546",
    section: "#3d4861",
    track: "#3b4457",
    node: "#e9edf4",
    city: "#ffc66b",
    skyDay: "#8fb0ff",
    skyNight: "#161c33",
    sunDay: "#fff2d6",
    sunDusk: "#ff9f5a",
  },
  light: {
    fog: "#f2f3f6",
    ground: "#dfe4ec",
    cell: "#cdd4df",
    section: "#b3bdcc",
    track: "#aeb8c8",
    node: "#1f2733",
    city: "#ff9a1f",
    skyDay: "#dbe6ff",
    skyNight: "#5b6a94",
    sunDay: "#fff6e6",
    sunDusk: "#ffb36b",
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
