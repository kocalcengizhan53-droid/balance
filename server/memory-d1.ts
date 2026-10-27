import { DatabaseSync, type SQLInputValue } from "node:sqlite"

/**
 * Enough of D1 to run the API's handlers in a test: prepare, bind, first, all, run and batch,
 * over Node's built-in SQLite with the real migrations applied.
 */
export function memoryD1(schema: string): D1Database {
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys = ON")
  db.exec(schema)
  const statement = (sql: string, params: SQLInputValue[] = []) => ({
    bind: (...values: unknown[]) =>
      statement(
        sql,
        values.map((v) => (v === undefined ? null : v)) as SQLInputValue[]
      ),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({
      results: db.prepare(sql).all(...params),
      success: true,
      meta: {},
    }),
    run: async () => ({
      success: true,
      meta: { changes: Number(db.prepare(sql).run(...params).changes) },
    }),
    exec: () => db.prepare(sql).run(...params),
  })
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => {
      db.exec("BEGIN")
      try {
        statements.forEach((s) => s.exec())
        db.exec("COMMIT")
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
      return statements.map(() => ({ success: true, meta: {} }))
    },
  } as unknown as D1Database
}
