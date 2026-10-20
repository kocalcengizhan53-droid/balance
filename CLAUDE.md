# Balance — grid dispatch

- Stack: Vite 8, React 19.3, TypeScript 6, Tailwind CSS 4, shadcn/ui on Base UI, React Router 8
- Before saying work is done run `npm run check` (typecheck, lint, tests, build); browser QA is `npm run qa`
- Code layout and rules follow the react-typescript-standards skill
- **The one rule:** every figure on screen is solved from `src/lib/grid/` — generation equals
  demand at every timestep, and a test asserts it. Nothing is typed into a component.
