import { useMemo, type ReactNode, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

/**
 * Labels are ordinary DOM, drawn beside the canvas and moved by a projector each frame. drei's
 * Html component does the same job with a React root per label in a portal, and on React 19
 * that root tears down a node the parent has already removed when the page is left — a
 * `removeChild` error on every navigation away from the overview. Nothing here is portalled,
 * so nothing is removed twice.
 */
export type LabelSpec = {
  id: string
  at: [number, number, number]
  node: ReactNode
  /** Hang above the point (plants), or sit just below it (substations, on the ground). */
  place?: "above" | "below"
}
export type LabelRefs = RefObject<
  Map<string, { at: THREE.Vector3; el: HTMLElement | null }>
>

export function Projector({ refs }: { refs: LabelRefs }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const { at, el } of refs.current.values()) {
      if (!el) continue
      v.copy(at).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const visible =
        v.z < 1 &&
        x > -80 &&
        x < size.width + 80 &&
        y > -40 &&
        y < size.height + 40
      const lift = el.dataset.place === "below" ? "10%" : "-100%"
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, ${lift})`
      el.style.opacity = visible ? "1" : "0"
      el.style.pointerEvents = visible ? "" : "none"
    }
  })
  return null
}

export function SceneLabels({
  labels,
  refs,
  name,
}: {
  labels: LabelSpec[]
  refs: LabelRefs
  name: string
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {labels.map((label) => (
        <div
          key={label.id}
          ref={(el) => {
            refs.current.set(label.id, {
              at: new THREE.Vector3(...label.at),
              el,
            })
          }}
          data-place={label.place ?? "above"}
          className="absolute top-0 left-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          {label.node}
        </div>
      ))}
    </div>
  )
}
