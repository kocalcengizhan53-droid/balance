import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/use-theme"

/** Light is the default here; the dark mode exists because a control room is a dark room. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      <span className="text-xs tracking-wide uppercase">{next}</span>
    </Button>
  )
}
