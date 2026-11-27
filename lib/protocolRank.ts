// Ranking the board: who may be ranked, in which order, and the live set kept separate.
//
// The board is the watchlist plus every other genuine pre-token protocol the snapshot holds.
// A protocol counts as pre-token when its record carries no token at all; the ones that already
// trade are never ranked — they appear in the live view at their market caps instead. The
// watchlist is a floor, not a ceiling: anything below it that is genuinely pre-token joins the
// board, and the board ranks everything it holds by one model of implied value.

import type { Snapshot, SnapshotProtocol } from './snapshot.ts';
import { MODEL, MODEL_VERSION, impliedValue, round4, type ModelConstants } from './valueModel.ts';
import { farmSteps, stepText } from './farmPlan.ts';

/** One row of board.json. */
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
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    reach_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** One row as the dashboard reads it: the board's fields plus the watchlist flag, farm plans built in the page. */
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
  implied_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  reach_multiplier: number;
  on_watchlist: boolean;
}

/** A protocol whose token already trades: the market's own value, shown apart from the ranking. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The whole dataset the dashboard renders. */
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
  rows: RadarRow[];
  live: LiveRow[];
}

/** The headline counts: watchlist, board, early rows, live rows. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** A name that ends in a version marker (V2, v2, 2.0) names a pool of another protocol. */
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that only wrap, stake or bridge a token that already trades. */
const WRAPPER_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** A whole word wrapped, staked or staking in a name marks another token's product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchanges whose name at the start of a protocol name marks their own product. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** True when the record carries no token: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** True when a protocol is a wrapped, staked or bridged product of a token that already trades. */
function isWrappedProduct(p: SnapshotProtocol): boolean {
  if (p.category !== null && WRAPPER_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  return false;
}

/**
 * True when the board may rank a protocol: it records no token, and it is not a wrapped, staked
 * or bridged product of a token that already trades. This is the watchlist's own exclusion rule,
 * applied to the whole board, so no ranked row is WBTC, a staked-ETH product or a bridge in disguise.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedProduct(p);
}

/** The snapshot's protocols, looked up by slug. */
function indexBySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  const index = new Map<string, SnapshotProtocol>();
  for (const p of protocols) index.set(p.slug, p);
  return index;
}

/** The protocols the board ranks: the watchlist first, then every other rankable one. */
function pickCandidates(snapshot: Snapshot): SnapshotProtocol[] {
  const index = indexBySlug(snapshot.protocols);
  const picked = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: take every slug it names that the snapshot still carries. Even a
  // slug the snapshot no longer carries must not gamble the coverage check, so only present
  // records are taken, and the gate's coverage row is checked again in boardIssue.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) picked.set(slug, p);
  }
  // The early radar: every genuine pre-token protocol the watchlist leaves out, whatever its size.
  // No cap and no TVL cutoff — finding the early ones is what the radar is for.
  for (const p of snapshot.protocols) {
    if (!picked.has(p.slug) && isRankable(p)) picked.set(p.slug, p);
  }
  return [...picked.values()];
}

/** One candidate with its score: the model's implied value and its parts. */
interface Scored {
  p: SnapshotProtocol;
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  reachMult: number;
  age: number | null;
}

/** Score every candidate with the model. */
function scoreCandidates(candidates: SnapshotProtocol[], snapshot: Snapshot, model: ModelConstants): Scored[] {
  return candidates.map((p) => {
    const scored = impliedValue(p, snapshot.as_of, model);
    return {
      p,
      implied: scored.implied,
      growthPct: scored.growthPct,
      growthMult: scored.growthMult,
      maturityMult: scored.maturityMult,
      reachMult: scored.reachMult,
      age: scored.age,
    };
  });
}

/** Strongest implied value first; ties break on slug so the order is stable. */
function byValue(a: Scored, b: Scored): number {
  if (b.implied !== a.implied) return b.implied - a.implied;
  if (a.p.slug < b.p.slug) return -1;
  if (a.p.slug > b.p.slug) return 1;
  return 0;
}

/** One scored candidate as a board row, with its rank and farm plan. */
function toBoardRow(s: Scored, rank: number, model: ModelConstants): BoardRow {
  return {
    rank,
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
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      reach_multiplier: round4(s.reachMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  };
}

/** The board: every rankable protocol, strongest implied value first, ranked 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const scored = scoreCandidates(pickCandidates(snapshot), snapshot, model);
  scored.sort(byValue);
  return scored.map((s, i) => toBoardRow(s, i + 1, model));
}

/** The live-token protocols, largest market cap first, capped at 24 for the dashboard. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX');
  live.sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd);
  return live.slice(0, 24).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));
}

/** A board row in the dashboard's compact form, the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
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
    implied_multiple: round4(row.implied_value_usd / row.tvl_usd),
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    reach_multiplier: row.model.reach_multiplier,
    on_watchlist: onWatchlist,
  };
}

/** The board and everything the dashboard renders from it. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
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
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The first coverage problem, or null: every watchlist slug must be on the board. */
function coverageProblem(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length === 0) return null;
  const plural = missing.length === 1 ? '' : 's';
  return `the board misses ${missing.length} watchlist slug${plural}: ${missing.slice(0, 5).join(', ')}`;
}

/** The first rank or order problem, or null: ranks 1..n, values never rising with rank. */
function orderProblem(board: BoardRow[]): string | null {
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  return null;
}

/** The first row-content problem, or null: farm steps in range, implied value a safe positive integer. */
function rowProblem(board: BoardRow[]): string | null {
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  return coverageProblem(board, snapshot) ?? orderProblem(board) ?? rowProblem(board);
}
