import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Box } from "lucide-react"

import { TICK_MS } from "@/features/dashboard/clock"
import { useGrid } from "@/features/dashboard/useGrid"
import { daylight } from "@/features/scene/daylight"
import { useDark } from "@/features/scene/palette"

/*
 * The scene is three, fiber and drei — more than the rest of the app together. It arrives in its
 * own chunk, and until it does the stage shows a picture of it: rendered from the same scene by
 * `npm run posters`, one per theme and shape. On a desktop the live scene loads once the page is
 * idle and fades in over the picture. A phone pays for three megabytes of WebGL in battery and in
 * the time before the page answers a tap, so there the live scene waits to be asked for and the
 * stage plays a video of the same scene through the day instead — `npm run scene-video` renders
 * it, 0.72 s per half-hour like the clock — kept on whatever half-hour the dashboard shows.
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
 * answer until it is asked to draw; `canDraw` below asks then. Should the scene still fail, the
 * boundary catches it and the picture stays.
 */
const HAS_WEBGL = typeof WebGLRenderingContext !== "undefined"

/*
 * The API can exist while no context can be made (a GPU blocklist, a browser started with WebGL
 * off, as on a CI runner). So a real context is tried once, at the moment the live scene would
 * start — after load, not during it — and if there is none the picture simply stays.
 */
function canDraw() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

/** Linear blend of two #rrggbb colours. */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ")})`
}

const PER_PERIOD = TICK_MS / 1000
// Read when the app starts: the dashboard rewrites the query string from its own state soon after.
const CAPTURE =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("capture")
const REDUCED =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The day on video, locked to the dashboard's clock: while the clock runs the video runs beside
 * it and is pulled back into step if it drifts; when the clock stops, it parks in the middle of
 * the half-hour on screen, so the light always matches the figures under it.
 */
function DayVideo({
  theme,
  period,
  playing,
}: {
  theme: "dark" | "light"
  period: number
  playing: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const v = video.current
    if (!v) return
    const at = period * PER_PERIOD
    if (playing) {
      if (v.paused || Math.abs(v.currentTime - at) > 0.3) v.currentTime = at
      v.play().catch(() => undefined)
    } else {
      v.pause()
      v.currentTime = at + PER_PERIOD / 2
    }
  }, [period, playing])

  return (
    <video
      ref={video}
      src={`/scene-${theme}-tall.mp4`}
      muted
      playsInline
      loop
      preload="auto"
      aria-hidden="true"
      onPlaying={() => setShown(true)}
      onSeeked={() => setShown(true)}
      className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-700 ${shown ? "opacity-100" : "opacity-0"}`}
    />
  )
}

const SKY = {
  dark: { day: "#24365f", dusk: "#4a2f2a", night: "#141a33" },
  light: { day: "#dfe8ff", dusk: "#ffe4cc", night: "#c9d1ec" },
}

export function SceneStage({ fallback }: { fallback: ReactNode }) {
  const { period, playing } = useGrid()
  const dark = useDark()
  const phone = usePhone()
  const [live, setLive] = useState(false)
  const [ready, setReady] = useState(false)
  const [posterOk, setPosterOk] = useState(true)
  const [noContext, setNoContext] = useState(false)
  const goLive = () => (canDraw() ? setLive(true) : setNoContext(true))

  useEffect(() => {
    if (!HAS_WEBGL || noContext || phone || live) return
    // Safari has no requestIdleCallback; a short timeout after load stands in for it.
    const start = () => (canDraw() ? setLive(true) : setNoContext(true))
    const idle = typeof requestIdleCallback === "function"
    const id = idle
      ? requestIdleCallback(start, { timeout: 1800 })
      : setTimeout(start, 600)
    return () => (idle ? cancelIdleCallback(id as number) : clearTimeout(id))
  }, [phone, live, noContext])

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
      {phone && !live && !CAPTURE && !REDUCED ? (
        <DayVideo key={theme} theme={theme} period={period} playing={playing} />
      ) : null}
      {live ? (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <SceneBoundary>
            <Suspense fallback={null}>
              <RegionScene onReady={() => setReady(true)} capture={CAPTURE} />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : null}
      {!live && HAS_WEBGL && !noContext && phone ? (
        <button
          type="button"
          onClick={goLive}
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
