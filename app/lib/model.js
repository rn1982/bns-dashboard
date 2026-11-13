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
 * @param {Record<string, number|null|undefined>} scores  per-indicator score in [-2, 2],
 *        keyed like WEIGHTS; null/undefined = indicator unavailable.
 * @returns {{ score: number|null, coverage: number, missing: string[], partial: boolean,
 *            verdict: object|null }}
 *
 * Missing indicators are left out and the remaining weights are scaled up so they
 * still sum to 1. Treating a missing indicator as 0 instead would quietly pull the
 * forecast towards HOLD. Either way a partial score is less reliable than the
 * backtested one, which is why `partial` is returned and shown in the UI.
 */
export function computeForecast(scores) {
  let weighted = 0;
  let coverage = 0;
  const missing = [];
  for (const [key, w] of Object.entries(WEIGHTS)) {
    const s = scores[key];
    if (typeof s === 'number' && Number.isFinite(s)) {
      weighted += s * w;
      coverage += w;
    } else {
      missing.push(key);
    }
  }
  coverage = Math.round(coverage * 1000) / 1000;
  if (coverage < MIN_COVERAGE) {
    return { score: null, coverage, missing, partial: true, verdict: null };
  }
  const score = Math.round((weighted / coverage) * 1000) / 1000;
  return { score, coverage, missing, partial: missing.length > 0, verdict: verdictFromScore(score) };
}
