import { createContext } from "react"

export type Theme = "dark" | "light" | "system"

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

/**
 * In its own file so the provider module exports only a component. A module that also exports
 * a context or a hook breaks fast refresh, which is the rule the template switched off
 * project-wide instead of obeying.
 */
export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)
