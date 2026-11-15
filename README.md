# Token Radar — radar-3

A token launch radar. It reads a sealed DefiLlama snapshot of 758 protocols, fits a
comps curve on the protocols whose tokens already trade, tests the fit out of sample,
and ranks every pre-token protocol by the implied value its launch would carry — each
with a costed, netted farm plan and a farm / thin / skip call.

## The model in three lines

- `log10(mcap) = a + b x log10(tvl) + category adjustment`, fit by least squares on the
  snapshot's own token-bearing protocols (winsorised; one 400x outlier cut), with a
  shrunk median-residual adjustment per category.
- Implied value = TVL x fitted multiple x small growth tilt x small maturity tilt, with
  a band from the middle half of the comps' residuals. Held-out test (every 5th comp):
  median error 74.7%, vs 85.0% for a flat multiple and 86.3% for the starter's 0.25.
  Category adjustments are capped at 0.2 dex so one-comp categories cannot swing a
  whole category's values (radar-3; was 0.4 dex in radar-2).
- Farmer EV = implied x 10% / 10,000 farmers − farm cost (gas only; capital returns).
  Farm at $100+, thin above $0, skip at or below $0.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22+, standard library only. Writes `board.json`, `data.js`, `dashboard/`,
`screenshots/` and `dossier.json` to the output directory. Run it twice: both runs
write the same bytes.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, writes the board and the dossier.
- `lib/model.ts` — the comps fit, the holdout test, the board and the farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page (index.html, app.css, app.js). No network, no framework.
- `screenshots/` — three renders of the dashboard: the board, a detail view, a filtered view.
