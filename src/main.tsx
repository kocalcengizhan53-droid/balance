import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"

import { ThemeProvider } from "@/components/theme-provider"
import { installDevtools } from "@/devtools"
import { router } from "@/router"
import "./index.css"

installDevtools()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
)
