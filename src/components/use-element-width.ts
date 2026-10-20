import { useEffect, useRef, useState } from "react"

/**
 * A ref to attach, and that element's rendered width in CSS pixels.
 *
 * An SVG with a fixed viewBox scales its type along with its geometry: the dispatch chart's
 * 1000-unit canvas in a 358px phone column rendered its 11px axis labels at four pixels, which
 * is not small type, it is no type. Setting the viewBox to the measured width makes one user
 * unit one pixel, so a label is the size it claims to be at every viewport and it is the
 * drawing that stretches.
 */
export function useElementWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
