import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const subscribe = (notify: () => void) => {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", notify)
  return () => mql.removeEventListener("change", notify)
}

/** True below the sidebar's breakpoint. An external store, not state set from an effect. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
