import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Box } from "lucide-react"

import { useGrid } from "@/features/dashboard/useGrid"
import { daylight } from "@/features/scene/daylight"
import { useDark } from "@/features/scene/palette"

/*
 * The scene is three, fiber and drei — more than the rest of the app together. It arrives in its
 * own chunk, and until it does the stage shows a picture of it: rendered from the same scene by
 * `npm run posters`, one per theme and shape. On a desktop the live scene loads once the page is
 * idle and fades in over the picture; on a phone it waits to be asked for, because a phone pays
 * for three megabytes of WebGL in battery and in the time before the page answers a tap.
 */
const RegionScene = lazy(() =>
  import("@/features/scene/RegionScene").then((m) => ({
    default: m.RegionScene,
  }))
)

/** If the scene throws — a driver bug, a lost context — the picture stays and the page lives on. */
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const PHONE = "(max-width: 767px)"
const subscribe = (notify: () => void) => {
  const mq = matchMedia(PHONE)
  mq.addEventListener("change", notify)
  return () => mq.removeEventListener("change", notify)
}
const usePhone = () =>
  useSyncExternalStore(
    subscribe,
    () => matchMedia(PHONE).matches,
    () => false
  )

/*
 * Whether the browser has WebGL at all — the API, not a context. Creating a context just to ask
 * costs tens of milliseconds on a phone (far more without a GPU) and the phone does not need the
 * answer until it is asked to draw. If the live scene then fails to start, the boundary below
 * catches it and the picture stays.
 */
const HAS_WEBGL = typeof WebGLRenderingContext !== "undefined"

/** Linear blend of two #rrggbb colours. */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ")})`
}

const SKY = {
  dark: { day: "#24365f", dusk: "#4a2f2a", night: "#141a33" },
  light: { day: "#dfe8ff", dusk: "#ffe4cc", night: "#c9d1ec" },
}

export function SceneStage({ fallback }: { fallback: ReactNode }) {
  const { period } = useGrid()
  const dark = useDark()
  const phone = usePhone()
  const [live, setLive] = useState(false)
  const [ready, setReady] = useState(false)
  const [posterOk, setPosterOk] = useState(true)

  useEffect(() => {
    if (!HAS_WEBGL || phone || live) return
    // Safari has no requestIdleCallback; a short timeout after load stands in for it.
    const start = () => setLive(true)
    const idle = typeof requestIdleCallback === "function"
    const id = idle
      ? requestIdleCallback(start, { timeout: 1800 })
      : setTimeout(start, 600)
    return () => (idle ? cancelIdleCallback(id as number) : clearTimeout(id))
  }, [phone, live])

  if (!HAS_WEBGL && !posterOk) return <>{fallback}</>

  const d = daylight(period)
  const sky = SKY[dark ? "dark" : "light"]
  const glow = mix(mix(sky.day, sky.dusk, d.warmth), sky.night, d.night)
  const shape = phone ? "tall" : "wide"
  const theme = dark ? "dark" : "light"

  return (
    <div
      data-scene={ready ? "live" : live ? "loading" : "poster"}
      className="absolute inset-0 transition-[background] duration-700"
      style={{
        background: `radial-gradient(70% 75% at 55% 40%, ${glow}, transparent 75%)`,
      }}
    >
      {posterOk ? (
        <img
          src={`/scene-${theme}-${shape}.webp`}
          alt=""
          fetchPriority="high"
          decoding="async"
          onError={() => setPosterOk(false)}
          className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
        />
      ) : null}
      {live ? (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <SceneBoundary>
            <Suspense fallback={null}>
              <RegionScene onReady={() => setReady(true)} />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : null}
      {!live && HAS_WEBGL && phone ? (
        <button
          type="button"
          onClick={() => setLive(true)}
          className="glass absolute right-4 bottom-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground"
        >
          <Box className="size-4" aria-hidden="true" />
          Explore in 3D
        </button>
      ) : null}
      {live && !ready ? (
        <p
          role="status"
          className="absolute right-4 bottom-4 z-10 label text-muted-foreground"
        >
          Building the region…
        </p>
      ) : null}
    </div>
  )
}
