/** Geometry shared by the frequency dial and the trace beside it. */

export const CX = 120
export const CY = 118
export const R = 98
export const LOW = 48
export const HIGH = 52

/** Degrees to turn a needle drawn pointing straight up, for a frequency. */
export const needleTurn = (f: number) =>
  ((Math.min(HIGH, Math.max(LOW, f)) - 50) / (HIGH - LOW)) * 180

/** The thirty seconds after a trip, drawn as it is replayed. */
export const TRACE = { w: 300, h: 92, top: 50.2, bottom: 48.2, seconds: 30 }
export const traceX = (t: number) => (t / TRACE.seconds) * TRACE.w
export const traceY = (f: number) =>
  4 +
  ((TRACE.top - Math.min(TRACE.top, Math.max(TRACE.bottom, f))) /
    (TRACE.top - TRACE.bottom)) *
    (TRACE.h - 8)
