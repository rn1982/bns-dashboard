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
