import * as React from "react"

import { ThemeProviderContext } from "@/components/theme-context"

/**
 * In its own file because a module that exports both a component and a hook breaks fast
 * refresh — the rule the template switched off project-wide rather than obeyed.
 */
export function useTheme() {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
