# Balance

A grid control room for a region that does not exist, solved half-hourly, built the way a product dashboard is built — a rail, four pages, a command palette, KPI cards that compare against the last half-hour, a table you can filter and page — where every number on every page, and every particle moving across the map, is the output of one model.

**Live:** <https://balance-dispatch.pages.dev>

![Overview: the region in three dimensions, power moving along the lines to the city, KPI cards with their trend against the previous half-hour, the levers](docs/dashboard.png)

---

## The one rule

Nothing is typed into a component. Every figure — the rail's status card, the masthead clock and frequency, the KPI trend badges, the stacked day, the supply curve, the settlement table, the events feed, and the width, count and speed of every particle in the scene — is derived from [`src/lib/grid/`](src/lib/grid), and the arithmetic has one invariant:

```
generation + imports + unserved === demand + exports
```

to within 0.1 MW, in all forty-eight periods, under every lever, and still true with the two largest units out. That is the first test in [`dispatch.test.ts`](src/lib/grid/dispatch.test.ts), and it is the reason four pages can be trusted to agree with each other.

## The pages

**Overview.** The region as a place: plants where they stand, sized by capacity and lit by their output; power as particles, a count of them proportional to the megawatts and a speed set by how hard the plant behind them is working; the sun crossing with the clock, the city lighting at dusk. Beneath it, the instruments: five KPI cards with a trend badge against the previous half-hour, the day stacked by fuel with a range control and a pointer readout, the system as a single-line diagram, and an events feed — every line of it a diff between two consecutive solves.

**Fleet.** The table every template has, with the solver underneath it: tabs by status, search, a fuel filter, a column menu, row selection with a bulk action, sortable headers, status badges, a pager, and a drawer per unit with its day as a sparkline and the one switch that takes it out.

![The fleet table, and the drawer behind a row](docs/fleet-drawer.png)

**Market.** Price and carbon across the day as two charts rather than one with two axes, the supply curve for the selected half-hour, and the settlement run paged twelve half-hours at a time — the statement a trading desk would reconcile against.

![The market: price and carbon across the day, the supply curve, the settlement run](docs/market.png)

**Scenarios.** Three levers — carbon price, demand, wind — five presets worth pressing, and every figure against the baseline. Each comparison is two solves of the same model, nothing interpolated.

![A bad evening: calm, hot and priced — cost up 95%, imports up six-fold, thirteen half-hours short](docs/scenarios.png)

The view's inputs live in the URL — `?out=calder-a,calder-b&carbon=60&demand=1.1&wind=0.4&t=36` — so a scenario is a link somebody can send, and a reload is not a reset. Only inputs are stored, never a result.

![Two gas stations out and a carbon price on, from a link: the plants struck through, the frequency drooping, the rail saying so](docs/shortfall.png)

## What the model actually does

A merit-order dispatch with the constraints that make the merit order interesting:

- **Minimum stable generation.** A thermal plant below its floor is not turned down, it is off. Committing one is a step change, not a slope.
- **Ramp rates.** Output can only move so fast per period, and the day is solved twice so that midnight is consistent with itself rather than starting cold.
- **Unit commitment.** Greedy, cheapest first, with must-run plant and free fuel on the system before the market is asked anything.
- **A constrained-on unit does not set the price.** At 04:00 both Calder stations are generating at £62 and £64 while the region is exporting at £41: they are running because they cannot shut down and restart inside half an hour, not because anybody is paying for them. The fleet table calls that state *constrained* and gives it its own tab.

The last of those arrived as a failing test. The test asserted that the price equals the cost of the dearest running plant, which is the intuition, and the model disagreed — biomass at £79 was on the system while the price was £71. The model was right and the test was the defect, which is the kind of result that only shows up when the model is real enough to argue with.

The levers found a second defect the baseline could not reach. With the link importing flat out and a thermal unit committed at its minimum stable output overshooting demand, the surplus branch wrote the export straight over the import — 1,000 MW vanished from the books. A £150 carbon price put gas behind the import, and the balance test failed in the first period. The link now gives back import before it exports, which is also what a control room does.

## The room

Dark by default, because the room it is modelled on is dark. Every surface is biased a few steps toward blue so the fuel colours sit on something with a temperature; every figure is set in a mono instrument face so the digits hold still as the clock runs; one amber means *live* and is used for nothing else. The light theme is designed rather than inverted.

![The light theme](docs/light.png)

The scene is [React Three Fiber](src/features/scene/RegionScene.tsx) and fetches nothing — three light panels baked once, a terrain of three sines, colours read from the page's own stylesheet so the plants are exactly the hues the charts use. It arrives in its own chunk after the instruments have painted, a viewport-aware camera pulls back and widens on a phone, and where there is no WebGL the single-line diagram stands in. Its labels are ordinary DOM moved by a projector each frame rather than drei's portalled `<Html>`, which on React 19 removes a node its parent has already removed every time the page is left.

The fuel palette is checked rather than chosen: eight categorical hues validated for deuteranopia, protanopia and tritanopia separation, normal-vision separation and contrast against each theme's card surface. Four hues sit under 3:1 on their surface, which is why every series also has a labelled readout and a table.

## The checks

Seventeen Vitest tests on the model and the readings derived from it. Forty-four Playwright checks in [`e2e/`](e2e), run against the production bundle on a desktop and a Pixel 7.

The load-bearing one is [`figures.spec.ts`](e2e/figures.spec.ts). The rule above is that no number is typed into a component, and a unit test cannot see that — it can only check the solver, and the solver was never what was at risk. So the browser re-solves the day from the view's own inputs and compares the result against the text actually painted — on the overview and row by row on the fleet page, at rest, after the period changes, and with two units offline.

[`layout.spec.ts`](e2e/layout.spec.ts) measures the painted size of every piece of text inside every SVG at four widths and fails below 9px, because the dispatch chart once set its axis labels in viewBox units: 11px in the source, four pixels on a phone. [`shell.spec.ts`](e2e/shell.spec.ts) drives the rail, the palette, the table's tabs, search, column menu, selection, drawer and pager, the settlement run's pages and a scenario preset.

Three defects in the product that only the browser suite found, none of them in the specs: cmdk's input rendering outside cmdk's root inside the Base UI dialog, drei's labels tearing down a removed node on navigation, and Base UI's `DropdownMenuLabel` throwing outside a `DropdownMenuGroup` — the column menu was crashing the fleet page in production. **No check here is trusted until the bug it was written for has been put back**: typing a fixed `£96` into the price tile is invisible at 18:00, where £96 is the right answer, and fails the moment the period moves.

## Running it

Node 24 LTS.

```bash
npm install
npm run dev          # http://localhost:5173

npm run check        # typecheck, lint, Vitest, build
npm run qa           # builds, serves the bundle, runs the browser checks
npm run qa:dev       # the same checks against the dev server

npm run deploy       # builds and ships dist/ to Cloudflare Pages
```

`wrangler pages project create` now delegates to Cloudflare Workers, and on its way it rewrites `vite.config.ts` and `package.json` — the injected `cloudflare()` Vite plugin stops Vitest from starting. The project here was made with `--force`, which takes the classic Pages path; `npm run deploy` goes straight to it and changes nothing.

## Stack

Vite 8 · React 19.3 with the React Compiler · TypeScript 6 · Tailwind CSS v4 · shadcn/ui on Base UI · React Router 8 · three 0.186 / React Three Fiber 9.8 / drei · Motion 14 · cmdk · Vitest 5 · Playwright · Cloudflare Pages.

No charting library: every mark is an SVG path built from the solved periods, so the geometry and the figures cannot come from different places.

The region is fictional. The constraints are not.
