# Balance

A grid control room for a region that does not exist, solved half-hourly, where every number on the screen is the output of one model.

Forty-eight settlement periods of economic dispatch across eleven generating units, four nodes and an interconnector. Take a station offline and the whole day re-solves: the merit order shifts, a dearer unit is called, the price moves, the carbon intensity moves with it, and if the system can no longer meet demand it says so.

**Live:** <https://balance-dispatch.pages.dev>

![The dashboard at the evening peak: carbon intensity, the day stacked by fuel, and the demand line over the top](docs/dashboard.png)

---

## The one rule

Nothing is typed into a component. Every figure — the tiles, the stacked day, the supply curve, the diagram, the table — is derived from [`src/lib/grid/`](src/lib/grid), and the arithmetic has one invariant:

```
generation + imports + unserved === demand + exports
```

to within 0.1 MW, in all forty-eight periods, and still true with the two largest units out. That is the first test in [`dispatch.test.ts`](src/lib/grid/dispatch.test.ts), and it is the reason the rest of the dashboard can be trusted to agree with itself.

## What the model actually does

Not a stacked chart with plausible numbers under it. A merit-order dispatch with the constraints that make the merit order interesting:

- **Minimum stable generation.** A thermal plant below its floor is not turned down, it is off. Committing one is a step change, not a slope.
- **Ramp rates.** Output can only move so fast per period, and the day is solved twice so that midnight is consistent with itself rather than starting cold.
- **Unit commitment.** Greedy, cheapest first, with must-run plant and free fuel on the system before the market is asked anything.
- **A constrained-on unit does not set the price.** At 04:00 both Calder stations are generating at £62 and £64 while the region is exporting at £41: they are running because they cannot shut down and restart inside half an hour, not because anybody is paying for them.

The last of those arrived as a failing test. The test asserted that the price equals the cost of the dearest running plant, which is the intuition, and the model disagreed — biomass at £79 was on the system while the price was £71. The model was right and the test was the defect, which is the kind of result that only shows up when the model is real enough to argue with.

Three more defects the tests caught, each of which rendered as a plausible-looking chart:

- `rampRate: 0` meant "does not follow load" in the data and was read as "can never start" by the clamp, so 1,180 MW of nuclear never generated in any period.
- The interconnector was appended to the merit order after the sort, so the battery ran at £104 while the neighbour was offering £96.
- The commitment loop broke as soon as demand was met, leaving a committed unit instructed to zero — a 420 MW step on a machine that can move 360 MW in a period.

## Reading it

![The system as a single-line diagram: every unit on its own row, feeding its node, feeding one busbar](docs/schematic.png)

The diagram was drawn as a map first, with units at invented coordinates and lines radiating to their nodes. It looked like a grid and could not be read: NORTH printed through Glenock, CENTRAL through the demand figure the whole thing is built around, and the two left-hand units ran off the canvas. Nothing about a plant's position on an imaginary coastline is information. A row per unit is, and it cannot collide with itself.

Two channels for two questions: **line width is megawatts** — how much — and **dash speed is the fraction of what that unit could be giving** — how hard it is working. A nuclear station flat out and a battery flat out travel at the same speed and are nothing like the same width. Motion is off entirely under `prefers-reduced-motion`, where the width and the printed figure carry it alone.

The fuel palette is checked rather than chosen: eight categorical hues validated for deuteranopia, protanopia and tritanopia separation, normal-vision separation and contrast against each surface, with a separate set of steps for the dark theme rather than an automatic flip. Three of the eight sit under 3:1 on the light surface, which is why every series also has a labelled readout and a table, and identity is never carried by colour alone.

![The same day with the two largest gas stations out: the shortfall drawn as a hatched band between what the system produced and what was asked of it](docs/shortfall.png)

When the system cannot meet demand, the gap between the stack and the demand line is hatched. Until that band was drawn, a failing system rendered as an absence — the one condition a control room is watching for, shown as nothing.

## The checks

Eight Vitest tests on the model. Twenty-six Playwright checks in [`e2e/`](e2e), run against the production bundle on a desktop and a Pixel 7.

The load-bearing one is [`figures.spec.ts`](e2e/figures.spec.ts). The rule above is that no number is typed into a component, and a unit test cannot see that — it can only check the solver, and the solver was never what was at risk. So the browser re-solves the day from the view's own inputs and compares the result against the text actually painted, in three states: at rest, after the period changes, and with two units offline.

[`layout.spec.ts`](e2e/layout.spec.ts) measures the painted size of every piece of text inside every SVG, at four viewport widths, and fails below 9px. It exists because the dispatch chart set its axis labels in viewBox units: 11px in the source, four pixels on a phone. That is not small type, it is no type, and it passed every other check there was.

**Neither check was trusted until the bug it was written for had been put back.** Typing a fixed `£96` into the price tile is invisible at 18:00, where £96 happens to be the right answer, and fails the moment the period moves or a unit trips. Putting the merit curve back on a fixed canvas fails at 390px and nowhere else — which is exactly where that bug bites.

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

Vite 8 · React 19.3 with the React Compiler · TypeScript 6 · Tailwind CSS v4 · shadcn/ui on Base UI · React Router 8 · Vitest 5 · Playwright · Cloudflare Pages.

No charting library: every mark is an SVG path built from the solved periods, so the geometry and the figures cannot come from different places.

The region is fictional. The constraints are not.
