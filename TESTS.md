# Tests — token radar (radar-2)

Run 2026-11-15 from `~/workspace/makefun-radar/entry/` against the sealed snapshot
`../token-radar-01-kit/input/snapshot.json` (758 protocols, frozen 2026-11-14).

## Pipeline

- `MAKEFUN_OUTPUT_DIR=out1 node main.ts --input ../token-radar-01-kit/input/snapshot.json`
  exits 0. Same for a second run into `out2`.
- **Deterministic:** `diff -r out1 out2` prints nothing. Both runs write identical bytes
  for board.json, data.js, dashboard files, screenshots and dossier.json.
- Node 22+, standard library only. No npm dependency in the entry.

## Board

- **Row count:** 198 rows (40 watchlist + 158 early-radar). At least 100 rows: pass.
- **Watchlist coverage:** 40 / 40 slugs present. The check in main.ts exits 1 if any is
  missing; it exited 0.
- **Ranks:** exactly 1..198, no gaps, no duplicates.
- **Order:** implied value non-increasing with rank. Top row Steakhouse Financial
  $131,009,563; bottom row shmonad $1,674,937.
- **Live-token protocols set aside:** 24 pre-token-rule rows that record a token are
  excluded from the board and listed in the dossier's `excluded_live` (count 24).
- **Wrapped/bridged products excluded:** no row has category Bridge, Canonical Bridge,
  Liquid Staking, Liquid Restaking, Restaked BTC or CEX; no row name contains a whole
  word wrapped/staked/staking; no row name begins with an exchange name. Verified by a
  scan of board.json after the run (0 matches). This rule was added after the first
  test run, whose top five were coinbase-bridge, wbtc, base-bridge, binance-bitcoin
  and usdt0 — bridges and wrappers, not token launches. The revision is in
  `isRankable` in lib/model.ts.

## Model

- **Comps fit:** 127 token-bearing protocols (15 with a zero market cap excluded as
  dead or delisted). `log10(mcap) = 2.7920 + 0.5496 x log10(tvl)`, residual sd 0.806 dex.
- **Band:** middle half of the adjusted residuals, x0.34 to x2.90. Every row's low is
  below its base and its base below its high (checked over all 198 rows).
- **Out-of-sample test:** every 5th token-bearing protocol by slug held out (26 test,
  101 train). Median absolute error 77.7%, within 2x 31%, within 3x 38%. Baselines on
  the same split: flat median multiple 85.0% (within 2x 27%), starter 0.25 flat 86.3%
  (within 2x 23%). The fitted model beats both baselines. These numbers are computed
  by main.ts on every run and printed to stdout, and appear in the dashboard and the
  dossier. An independent Python fit of the same snapshot gave the same holdout
  medians (77.7% / 85.0% / 86.3%), cross-checking the TypeScript implementation.
- **No name special-casing:** one `scoreRow` function scores every row; the only
  per-category input is the shrunk median residual of that category's comps.

## Farm plans

- Every row has 6 farm steps (the kit allows 3–12); every step is 143–193 characters
  (the kit allows 20–600).
- Every step names a gas cost in dollars and a time. Farm cost is gas only; the
  deposit capital is stated and returns on exit, and is not counted as a cost.
- Every row has a net value (implied minus farm cost) and a farmer EV (10% of implied
  split among about 10,000 farmers, minus farm cost).
- **Calls:** 41 farm (EV $100+), 127 thin (EV above $0), 30 skip (EV $0 or below).
  Verified by counting board.json.

## Dashboard

- Opens offline: rendered from `file://` in headless Chromium with no network. No
  `http://` or `https://` string appears in dashboard/index.html, dashboard/app.css or
  dashboard/app.js (checked by grep; the only URL-like strings are the relative
  `../data.js` load and `#p=` / `#call=` hashes).
- `dashboard/` is 3 files, 35,977 bytes total — under the 64 KB dossier-text cap.
- Sort works on Rank, TVL, Age, Implied value and Farmer EV (click the headers).
- Filters work: category, chain, farm call, TVL band, token status and search. The
  filtered screenshot shows the farm-call filter returning 41 rows.
- The detail view opens for a row (click, or `#p=<slug>` in the URL) and recomputes the
  row's implied value in the page, stating whether it matches board.json.
- The model panel states the fit, the holdout test, the band and the farm rules, and
  the live-token set-aside count.

## Screenshots

- Exactly 3 PNGs in screenshots/, all 1440 x 900, all rendered by headless Chromium
  (Playwright) from the built dashboard, and each opened and read by eye:
  - `1-board.png` — the full board, 163,901 bytes. Headline, facts, filters and the
    top rows are legible; rank 1 Steakhouse Financial $131.0M.
  - `2-detail.png` — the detail view for Steakhouse Financial, 210,853 bytes. Model
    breakdown, farm economics and the farm plan are legible; the recompute line
    states the page's $131.0M matches board.json to the rounding shown.
  - `3-filtered.png` — the board filtered to farm calls, 163,619 bytes. The Farm call
    dropdown reads "Farm", the count reads "41 rows shown", every visible row carries
    a farm badge.
- All three are under the 512 KB cap.

## Dossier

- `out1/dossier.json` is 755,200 bytes (cap 1.5 MB); its text is 36,237 bytes
  (cap 65,536). It carries 3 images (the screenshots, embedded as base64, each with
  a sha256) and schema `makefun/dossier/v1`.
- The dossier text is the vendor's build: a "## Dashboard" block listing the 3
  dashboard files, then a "## Source" section with the dashboard source in full —
  all 35,977 bytes of it fit, nothing cut. The model narrative reaches the judge
  through the dashboard source in the dossier text and through the model panel
  visible in the screenshots; the fitted numbers themselves live in board.json and
  data.js, which the scorer reads directly.
- `buildDossier` completes without throwing (main.ts exits 0). The dossier's image
  sha256s match the screenshot files byte for byte — verified after the final run
  (the run must come AFTER the last screenshot, because the dossier embeds the
  screenshots as they stand when main.ts runs).

## Files

- `LICENSE` first line is exactly `SPDX-License-Identifier: MIT`.
- `.makefun/owner.json` parses as JSON and is exactly
  `{"wallet": "3SVUXAH6oXF4t6zrEdECUQN4NbWLPVHAAjtGkGVVqt4P"}`.
- `vendor/makefun-board.ts` is a byte-identical copy of the kit starter's file
  (sha256 9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e).
- `main.ts` and `lib/model.ts` were written by hand in this session from the starter
  as reference; no starter file was copied into the entry. Two genuine revisions were
  made after test runs showed a defect: the rankable rule now excludes wrapped,
  staked and bridged products (first run's top five were bridges and wrappers), and
  the detail view's recompute sentence now compares formatted values so it reads
  correctly when the two figures agree to the rounding shown.
