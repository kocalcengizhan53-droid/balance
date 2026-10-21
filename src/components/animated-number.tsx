import { useEffect, useRef } from "react"
import { animate, useMotionValue, useReducedMotion } from "motion/react"

/**
 * A figure that rolls to its new value instead of jumping.
 *
 * The text is written straight to the DOM on each frame rather than through state, so a
 * running clock with a dozen of these on screen re-renders nothing. The options are plain
 * values, not a formatter function: a function prop is a new identity on every render, and
 * an effect keyed on it restarts the roll every time the parent redraws.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(value)
  const reduced = useReducedMotion()

  useEffect(() => {
    const render = (v: number) => {
      if (!ref.current) return
      ref.current.textContent =
        prefix +
        v.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) +
        suffix
    }
    if (reduced) {
      motionValue.set(value)
      render(value)
      return
    }
    const controls = animate(motionValue, value, {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: render,
    })
    return () => controls.stop()
  }, [value, decimals, prefix, suffix, motionValue, reduced])

  return (
    <span ref={ref} className={className}>
      {prefix +
        value.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) +
        suffix}
    </span>
  )
}
