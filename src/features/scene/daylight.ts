/**
 * The light, from the clock. The sun's direction is fixed — an isometric board reads best lit
 * from one side — and the clock sets only how strong and how warm it is, how much the sky
 * fills in, and how bright the city's windows are. Sunrise is at six, sunset at eighteen.
 */
export function daylight(period: number) {
  const hour = period / 2
  const t = (hour - 6) / 12
  const up = t > 0 && t < 1
  const elevation = up ? Math.sin(t * Math.PI) : 0
  return {
    /** 0 at night, 1 at noon. */
    day: elevation,
    /** 1 at the horizon, 0 high in the sky; how orange the light is. */
    warmth: up ? 1 - Math.min(1, elevation * 2.4) : 0,
    /** 1 in darkness, fading out over the first and last hours of daylight. */
    night: up ? Math.max(0, 1 - elevation * 3) : 1,
  }
}
