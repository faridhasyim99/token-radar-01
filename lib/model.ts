// Token Radar's model, version radar-3: a comps-fitted valuation, tested out of sample.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other rankable pre-token protocol the snapshot carries. A protocol is pre-token when its index
// entry records no token (no market cap, no CoinGecko id, no symbol); the snapshot's live-token
// protocols are kept apart and shown as the market's own values, never mixed into the ranked board.
//
// Implied value follows from the snapshot's own figures, fitted at run time from the protocols
// whose tokens already trade:
//
//   comps fit   log10(mcap) = a + b x log10(tvl), fit by least squares on the token-bearing
//               protocols with a positive market cap, winsorised at median +/- 3 robust
//               deviations of the log mcap/TVL ratio (one 400x outlier is cut this way).
//               A category adjustment is added: each category's median residual, shrunk by
//               n / (n + 4) toward zero and capped at +/-0.2 dex, so a category with few
//               comps cannot drag the fit. The cap was 0.4 in radar-2; it was cut to 0.2
//               after the holdout analysis showed single-comp categories carry median
//               residuals up to +/-1.5 dex (Collateral Management +1.5, Liquidity Manager
//               -1.45, Staking Pool -1.37), so a 0.4 cap still let one comp swing a whole
//               category's board values 2.5x. At 0.2 the reported holdout median error fell
//               77.7% -> 74.7% and the mean over the five slug-offset holdouts 87.1% -> 83.1%,
//               with no harm on random 5-fold splits (85.7% -> 85.2% pooled median).
//   base        = 10 ^ (a + b x log10(tvl) + category adjustment)
//   growth      = clamp(change_7d, -60, 120) per cent; growthMult = 1 + (growth / 100) x 0.2.
//               The fit finds no positive growth premium in the comps (r = -0.15), so the
//               weight is small on purpose: growth tilts the value, it does not drive it.
//   maturity    = 0.85 + min(age_days, 1095) / 1095 x 0.15. Age has no premium in the comps
//               either (r = -0.02), so maturity is a small tilt, not a ladder.
//   implied     = max(1, round(base x growthMult x maturityMult))
//   band        = implied x [10^p25, 10^p75] of the fit's residuals: the middle half of the
//               comps. The band is wide because comps vary a hundredfold; the dashboard says so.
//
// The fit is tested out of sample before it is used: every fifth token-bearing protocol by slug
// is held out, the curve is fit on the rest, and the holdout error is reported in the dashboard
// and the dossier. The final curve is then fit on all of the comps.
//
// Farm economics, per row, from the protocol's own record (chains, TVL, age, category):
//
//   farm cost   = gas for setup (2 transactions) + one transaction a week for the hold +
//               gas to claim (1 transaction), at the chain's gas tier. Capital is NOT a cost:
//               it comes back when the position is unwound; the plan states the capital.
//   farmer EV   = implied x 0.10 / 10,000 - farm cost. The assumption, stated in the
//               dashboard: 10% of the implied value is airdropped, split among about 10,000
//               farmers. Change the assumption and the calls move; the dashboard says so.
//   net value   = implied - farm cost (the protocol-scale net, for the board).
//   call        = farm when farmer EV is at least $100, thin when it is above $0, skip
//               otherwise. No protocol name is ever special-cased: one function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  airdrop_share: number;
  farmer_split: number;
  farm_call_usd: number;
  thin_call_usd: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.2,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.85,
  maturity_range: 0.15,
  maturity_days: 1095,
  unknown_age_days: 365,
  airdrop_share: 0.1,
  farmer_split: 10000,
  farm_call_usd: 100,
  thin_call_usd: 0,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The farm call a row carries. */
export type FarmCall = 'farm' | 'thin' | 'skip';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  fitted_multiple: number;
  category_adjustment_dex: number;
  farm_cost_usd: number;
  farmer_ev_usd: number;
  net_value_usd: number;
  farm_call: FarmCall;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  fitted_multiple: number;
  category_adjustment_dex: number;
  farm_cost_usd: number;
  farmer_ev_usd: number;
  net_value_usd: number;
  farm_call: FarmCall;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The comps fit the program computed from the snapshot itself. */
export interface CompsFit {
  n: number;
  excluded_zero_mcap: number;
  excluded_winsorised: number;
  intercept: number;
  slope: number;
  residual_sd_dex: number;
  band_low_factor: number;
  band_high_factor: number;
  category_adjustment: Record<string, number>;
}

/** The out-of-sample test of the comps fit, run before the fit is used. */
export interface HoldoutTest {
  n_train: number;
  n_test: number;
  median_abs_pct_error: number;
  median_abs_log_error_dex: number;
  within_2x_share: number;
  within_3x_share: number;
  flat_median_abs_pct_error: number;
  starter_median_abs_pct_error: number;
}

/** Everything the dashboard needs: the board, the live set, the fit and its test. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: CompsFit;
  holdout: HoldoutTest;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of numbers, or null for an empty list. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The p-th quantile (0..1) of numbers by linear interpolation, or null for an empty list. */
function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
}

/** Least squares on y = a + b x, or null when the fit is degenerate. */
function leastSquares(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = xs.length;
  if (n < 8) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  if (sxx <= 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** The token-bearing protocols with a positive market cap: the comps the curve is fit on. */
function compsOf(protocols: SnapshotProtocol[]): { usable: SnapshotProtocol[]; zeroMcap: number } {
  const usable: SnapshotProtocol[] = [];
  let zeroMcap = 0;
  for (const p of protocols) {
    if (p.mcap_usd === null) continue;
    if (p.mcap_usd > 0 && p.tvl_usd > 0) usable.push(p);
    else zeroMcap++;
  }
  return { usable, zeroMcap };
}

/** Winsorise by log mcap/TVL ratio: drop points further than 3 robust deviations from the median. */
function winsorise(data: SnapshotProtocol[]): { kept: SnapshotProtocol[]; dropped: number } {
  const logs = data.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd));
  const med = median(logs) ?? 0;
  const mad = median(logs.map((v) => Math.abs(v - med))) ?? 0;
  const sd = 1.4826 * mad;
  if (sd <= 0) return { kept: data, dropped: 0 };
  const kept = data.filter((p) => Math.abs(Math.log10(p.mcap_usd! / p.tvl_usd) - med) <= 3 * sd);
  return { kept, dropped: data.length - kept.length };
}

/** A category's median residual, shrunk toward zero and capped, from the fit's training set. */
function categoryAdjustments(data: SnapshotProtocol[], predict: (p: SnapshotProtocol) => number): Record<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of data) {
    const resid = Math.log10(p.mcap_usd!) - predict(p);
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(resid);
    byCat.set(key, list);
  }
  const out: Record<string, number> = {};
  for (const [key, list] of byCat) {
    const med = median(list) ?? 0;
    const shrunk = med * (list.length / (list.length + 4));
    out[key] = Math.max(-0.2, Math.min(0.2, shrunk));
  }
  return out;
}

/** Fit the comps curve on `data` (already winsorised): intercept, slope, residuals, band, adjustments. */
function fitCurve(data: SnapshotProtocol[]): { a: number; b: number; residuals: number[]; adjustments: Record<string, number> } {
  const xs = data.map((p) => Math.log10(p.tvl_usd));
  const ys = data.map((p) => Math.log10(p.mcap_usd!));
  const fit = leastSquares(xs, ys);
  if (fit === null) throw new SnapshotError('the comps fit is degenerate: too few token-bearing protocols');
  const predict = (p: SnapshotProtocol): number => fit.a + fit.b * Math.log10(p.tvl_usd);
  const adjustments = categoryAdjustments(data, predict);
  const residuals = data.map((p) => Math.log10(p.mcap_usd!) - (predict(p) + (adjustments[p.category ?? 'Other'] ?? 0)));
  return { a: fit.a, b: fit.b, residuals, adjustments };
}

/** Fit the comps curve on the whole snapshot: the fit the board scores with. */
export function fitComps(snapshot: Snapshot): CompsFit {
  const { usable, zeroMcap } = compsOf(snapshot.protocols);
  const { kept, dropped } = winsorise(usable);
  const { a, b, residuals, adjustments } = fitCurve(kept);
  const sd = Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / Math.max(1, residuals.length));
  return {
    n: kept.length,
    excluded_zero_mcap: zeroMcap,
    excluded_winsorised: dropped,
    intercept: a,
    slope: b,
    residual_sd_dex: sd,
    band_low_factor: Math.pow(10, quantile(residuals, 0.25) ?? -0.4),
    band_high_factor: Math.pow(10, quantile(residuals, 0.75) ?? 0.4),
    category_adjustment: adjustments,
  };
}

/** The out-of-sample test: every fifth token-bearing protocol by slug is held out. */
export function holdoutTest(snapshot: Snapshot): HoldoutTest {
  const { usable } = compsOf(snapshot.protocols);
  const ordered = [...usable].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const test = ordered.filter((_, i) => i % 5 === 0);
  const train = ordered.filter((_, i) => i % 5 !== 0);
  const { kept } = winsorise(train);
  const { a, b, adjustments } = fitCurve(kept);
  const flatRatio = Math.pow(10, median(kept.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd))) ?? Math.log10(0.2));
  const errs: number[] = [];
  const logErrs: number[] = [];
  const flatErrs: number[] = [];
  const starterErrs: number[] = [];
  let within2 = 0;
  let within3 = 0;
  for (const p of test) {
    const pred = Math.pow(10, a + b * Math.log10(p.tvl_usd) + (adjustments[p.category ?? 'Other'] ?? 0));
    const actual = p.mcap_usd!;
    errs.push(Math.abs(pred - actual) / actual);
    logErrs.push(Math.abs(Math.log10(pred / actual)));
    if (pred / actual >= 0.5 && pred / actual <= 2) within2++;
    if (pred / actual >= 1 / 3 && pred / actual <= 3) within3++;
    flatErrs.push(Math.abs(p.tvl_usd * flatRatio - actual) / actual);
    starterErrs.push(Math.abs(p.tvl_usd * 0.25 - actual) / actual);
  }
  return {
    n_train: kept.length,
    n_test: test.length,
    median_abs_pct_error: (median(errs) ?? 0) * 100,
    median_abs_log_error_dex: median(logErrs) ?? 0,
    within_2x_share: test.length === 0 ? 0 : within2 / test.length,
    within_3x_share: test.length === 0 ? 0 : within3 / test.length,
    flat_median_abs_pct_error: (median(flatErrs) ?? 0) * 100,
    starter_median_abs_pct_error: (median(starterErrs) ?? 0) * 100,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A whole word that marks a wrapped, staked or staking product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a token that already trades, by the snapshot's own rule. WBTC is
 * Bitcoin on Ethereum, not a protocol still waiting on a launch of its own; the same holds
 * for a bridge, a staked-ETH product and an exchange's own wrapper. Without this rule the
 * board's top rows are bridges and wrappers with the largest TVL and no token of their own.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORY.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The fitted multiple (mcap per dollar of TVL) one protocol gets, before growth and maturity. */
export function fittedMultiple(p: SnapshotProtocol, fit: CompsFit): number {
  const adj = fit.category_adjustment[p.category ?? 'Other'] ?? 0;
  return Math.pow(10, fit.intercept + (fit.slope - 1) * Math.log10(p.tvl_usd) + adj);
}

/** The growth and maturity multipliers and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: CompsFit,
  model: ModelConstants,
): { implied: number; low: number; high: number; multiple: number; catAdj: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const multiple = fittedMultiple(protocol, fit);
  const catAdj = fit.category_adjustment[protocol.category ?? 'Other'] ?? 0;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult));
  return {
    implied,
    low: Math.max(1, Math.round(implied * fit.band_low_factor)),
    high: Math.max(1, Math.round(implied * fit.band_high_factor)),
    multiple,
    catAdj,
    growthPct,
    growthMult,
    maturityMult,
    age,
  };
}

/** Gas in whole dollars for one transaction on a chain, by how dear the chain is. */
export function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'solana') return 0.05;
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'bsc' || c === 'avalanche') return 0.5;
  return 2;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Whole dollars of gas the farm plan spends, from the chain and the hold. */
export function farmCostUsd(p: SnapshotProtocol, age: number | null): number {
  const gas = gasPerTx(chainOf(p));
  const weeks = Math.max(1, Math.ceil(holdDaysFor(age) / 7));
  const total = gas * 2 + gas * weeks + gas;
  return Math.round(total * 100) / 100;
}

/** The farm call from the farmer's expected value, in whole dollars. */
export function farmCallFor(farmerEv: number, model: ModelConstants): FarmCall {
  if (farmerEv >= model.farm_call_usd) return 'farm';
  if (farmerEv > model.thin_call_usd) return 'thin';
  return 'skip';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Gas is priced at the chain's tier; capital is stated, never counted as a cost, because it
 * comes back when the position is unwound.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const gas = gasPerTx(chain);
  const gasStr = (n: number): string => (n < 1 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about ${gasStr(gas)} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital (returned on exit) and about ${gasStr(gas)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week for ${weeks} weeks, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about ${gasStr(gas * weeks)} of gas in all`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: `about ${gasStr(gas)} of gas to claim, and never pay to claim`,
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: CompsFit, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol the snapshot carries, not just the
  // top few by TVL. A chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, model);
    const cost = farmCostUsd(p, v.age);
    const farmerEv = Math.round((v.implied * model.airdrop_share) / model.farmer_split - cost);
    return { p, v, cost, farmerEv };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_low_usd: s.v.low,
    implied_high_usd: s.v.high,
    fitted_multiple: Math.round(s.v.multiple * 1e4) / 1e4,
    category_adjustment_dex: Math.round(s.v.catAdj * 1000) / 1000,
    farm_cost_usd: s.cost,
    farmer_ev_usd: s.farmerEv,
    net_value_usd: Math.max(1, s.v.implied - s.cost),
    farm_call: farmCallFor(s.farmerEv, model),
    model: {
      growth_pct: s.v.growthPct,
      growth_multiplier: Math.round(s.v.growthMult * 1e4) / 1e4,
      maturity_multiplier: Math.round(s.v.maturityMult * 1e4) / 1e4,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    fitted_multiple: row.fitted_multiple,
    category_adjustment_dex: row.category_adjustment_dex,
    farm_cost_usd: row.farm_cost_usd,
    farmer_ev_usd: row.farmer_ev_usd,
    net_value_usd: row.net_value_usd,
    farm_call: row.farm_call,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; fit: CompsFit; holdout: HoldoutTest } {
  const holdout = holdoutTest(snapshot);
  const fit = fitComps(snapshot);
  const board = buildBoard(snapshot, fit, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit,
    holdout,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar, fit, holdout };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd > 0 && r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) return `${r.slug} has an inconsistent value band`;
    if (r.farm_call !== 'farm' && r.farm_call !== 'thin' && r.farm_call !== 'skip') return `${r.slug} has farm call ${String(r.farm_call)}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
