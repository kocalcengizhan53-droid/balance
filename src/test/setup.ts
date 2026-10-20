import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Component tests share one jsdom; without this the previous test's tree is still mounted.
afterEach(cleanup)
