// The forecasting model: weights, thresholds and the verdict.
// Pure (no imports, no DB) so the page and the tests use exactly the same code.

// Weights from the 2000–2025 backtest. They sum to 1.
export const WEIGHTS = {
  inflation: 0.30,
  realEstate: 0.20,
  exchangeRate: 0.15,
  ecb: 0.15,
  gdp: 0.10,
  unemployment: 0.05,
  fed: 0.05,
};

export const LABELS = {
  inflation: 'Inflation',
  realEstate: 'Real estate',
  exchangeRate: 'EUR/CHF',
  ecb: 'ECB policy',
  gdp: 'GDP growth',
  unemployment: 'Unemployment',
  fed: 'Fed policy',
};

// ---------- Per-indicator scoring: raw value -> score in [-2, +2] ----------
// Used by the reader routes (today's value) and by the meeting replay (past values),
// so both always apply exactly the same rules. Thresholds from the 2000–2025 backtest.

export function scoreInflation(cpi) {
  if (cpi > 2.5) return 2;   // overheating, strong hike pressure
  if (cpi >= 1.8) return 1;  // above comfort zone: SNB acts preemptively
  if (cpi >= 0.7) return 0;  // price stability zone
  if (cpi >= 0.0) return -1; // low inflation
  return -2;                 // deflation risk
}

export function scoreRealEstate(g) {
  if (g > 6.0) return 2;
  if (g > 4.0) return 1;
  if (g >= 2.0) return 0;
  if (g >= 0.0) return -1;
  return -2;
}

// EUR/CHF = CHF per EUR. High = weak franc (imported inflation) = hike pressure.
export function scoreExchangeRate(rate) {
  if (rate > 1.00) return 2;
  if (rate >= 0.98) return 1;
  if (rate >= 0.96) return 0;
  if (rate >= 0.94) return -1;
  return -2;
}

export function scoreGdp(g) {
  if (g > 2.5) return 2;
  if (g > 2.0) return 1;
  if (g >= 1.0) return 0;
  if (g >= 0.0) return -1;
  return -2;
}

// Swiss unemployment is structurally low, hence the narrow bands.
export function scoreUnemployment(u) {
  if (u < 2.0) return 2;
  if (u < 2.5) return 1;
  if (u <= 3.5) return 0;
  if (u <= 4.5) return -1;
  return -2;
}

// ECB / Fed stance (from app/lib/stance.js) -> score. Keep in sync with STANCES in indicators.js.
export const STANCE_SCORE = {
  hike_aggressive: 2,
  hike_moderate: 1,
  hold_hawkish_bias: 1,
  hold_neutral: 0,
  hold_dovish_bias: -1,
  cut_moderate: -1,
  cut_aggressive: -2,
};
export const scoreStance = stance => (stance in STANCE_SCORE ? STANCE_SCORE[stance] : null);

// Global score → verdict. Thresholds from the same backtest.
export const THRESHOLDS = { strong: 1.0, moderate: 0.35 };

// Below this share of total weight we refuse to give a verdict at all.
export const MIN_COVERAGE = 0.5;

export function verdictFromScore(score) {
  if (score >= THRESHOLDS.strong) return { direction: 'HIKE', strength: 'strong', text: 'Strong HIKE signal (50bp+ possible)' };
  if (score >= THRESHOLDS.moderate) return { direction: 'HIKE', strength: 'moderate', text: 'Moderate HIKE signal (25bp likely)' };
  if (score > -THRESHOLDS.moderate) return { direction: 'HOLD', strength: 'neutral', text: 'HOLD (no change expected)' };
  if (score > -THRESHOLDS.strong) return { direction: 'CUT', strength: 'moderate', text: 'Moderate CUT signal (25bp likely)' };
  return { direction: 'CUT', strength: 'strong', text: 'Strong CUT signal (50bp possible)' };
}

/**
 * Scale weights so they sum to 1 (sliders give any non-negative numbers).
 * Unknown keys are ignored, missing keys count as 0. Returns null if they sum to 0.
 */
export function normalizeWeights(weights) {
  const clean = Object.fromEntries(
    Object.keys(WEIGHTS).map(k => [k, Math.max(0, Number(weights?.[k]) || 0)])
  );
  const total = Object.values(clean).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v / total]));
}

/** True when `weights` (any scale) give the same shares as the backtested WEIGHTS. */
export function isBacktestedWeights(weights) {
  const n = normalizeWeights(weights);
  return !!n && Object.keys(WEIGHTS).every(k => Math.abs(n[k] - WEIGHTS[k]) < 1e-6);
}

/**
 * @param {Record<string, number|null|undefined>} scores  per-indicator score in [-2, 2],
 *        keyed like WEIGHTS; null/undefined = indicator unavailable.
 * @param {Record<string, number>} [weights]  any non-negative numbers keyed like WEIGHTS
 *        (normalised here); default = the backtested WEIGHTS.
 * @returns {{ score: number|null, coverage: number, missing: string[], partial: boolean,
 *            verdict: object|null, contributions: Record<string, {weight, score, contribution}> }}
 *
 * Missing indicators are left out and the remaining weights are scaled up so they
 * still sum to 1. Treating a missing indicator as 0 instead would quietly pull the
 * forecast towards HOLD. Either way a partial score is less reliable than the
 * backtested one, which is why `partial` is returned and shown in the UI.
 * contributions[k].contribution = how much indicator k adds to the global score
 * (they sum to `score`). weight = its share after normalising (before rescaling for missing ones).
 */
export function computeForecast(scores, weights = WEIGHTS) {
  const w = normalizeWeights(weights);
  const contributions = {};
  if (!w) {
    return { score: null, coverage: 0, missing: Object.keys(WEIGHTS), partial: true, verdict: null, contributions };
  }
  let weighted = 0;
  let coverage = 0;
  const missing = [];
  for (const key of Object.keys(WEIGHTS)) {
    const s = scores[key];
    if (typeof s === 'number' && Number.isFinite(s)) {
      weighted += s * w[key];
      coverage += w[key];
    } else {
      missing.push(key);
    }
  }
  coverage = Math.round(coverage * 1000) / 1000;
  for (const key of Object.keys(WEIGHTS)) {
    const s = scores[key];
    const ok = typeof s === 'number' && Number.isFinite(s) && coverage > 0;
    contributions[key] = { weight: w[key], score: ok ? s : null, contribution: ok ? (s * w[key]) / coverage : null };
  }
  // Only indicators with weight count as "missing" for the partial warning.
  const missingWeighted = missing.filter(k => w[k] > 0);
  if (coverage < MIN_COVERAGE) {
    return { score: null, coverage, missing: missingWeighted, partial: true, verdict: null, contributions };
  }
  const score = Math.round((weighted / coverage) * 1000) / 1000;
  return { score, coverage, missing: missingWeighted, partial: missingWeighted.length > 0, verdict: verdictFromScore(score), contributions };
}
