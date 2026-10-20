import { test as base, expect } from "@playwright/test"

/**
 * Shared fixtures — every spec imports `test` and `expect` from here.
 *
 * An uncaught page error fails the test. So does a console error, unless the test declares it
 * part of the scenario with `test.use({ allowedConsoleErrors: [/…/] })`.
 */
interface Fixtures {
  allowedConsoleErrors: RegExp[]
  failOnBrowserErrors: void
}

export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],

  failOnBrowserErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = []
      page.on("pageerror", (error) =>
        errors.push(`page error: ${error.message}`)
      )
      page.on("console", (message) => {
        if (message.type() !== "error") return
        const text = message.text()
        if (!allowedConsoleErrors.some((pattern) => pattern.test(text))) {
          errors.push(`console error: ${text}`)
        }
      })

      await use()

      expect(errors, "Browser errors during the test").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
