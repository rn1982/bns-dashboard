// Registry of every indicator stored in the one-row table `latest_indicators` (id = 1).
//
// For each indicator the table holds:
//   <valueCol>             the number used by the model
//   <updatedCol>           when we wrote it (fetch time, or time of the manual entry)
//   <prefix>_observed_at   the date the value refers to (e.g. 2026-09-01 for September CPI)
//   <prefix>_origin        'live' (written by the cron) or 'manual' (typed in by a user)
//   <prefix>_source        human-readable source name, e.g. "SNB data portal (plkopr)"
//
// Column names are only ever taken from this file, never from user input,
// so it is safe to put them into SQL strings.

// maxAgeDays: how old the OBSERVATION may be (today − observed_at) before the
// value is flagged "Stale". Set from each series' publication rhythm and lag, e.g.
// October CPI is dated 2026-10-01, published early November, and replaced early
// December, so it is normally up to ~65 days old. Quarterly GDP is dated at the
// start of the quarter and published ~5 months later, so it can be ~240 days old.
// live: true when the cron has a live source for it (false = manual only).

export const INDICATORS = {
  inflation:     { label: 'Swiss CPI inflation (YoY %)',    unit: '%',  live: true,  maxAgeDays: 70,  prefix: 'inflation',     valueCol: 'inflation_value',       updatedCol: 'inflation_updated_at',     min: -5,  max: 15 },
  snb_rate:      { label: 'SNB policy rate (%)',            unit: '%',  live: true,  maxAgeDays: 21,  prefix: 'snb',           valueCol: 'snb_policy_rate_value', updatedCol: 'snb_updated_at',           min: -2,  max: 10 },
  gdp:           { label: 'Swiss real GDP growth (YoY %)',  unit: '%',  live: true,  maxAgeDays: 250, prefix: 'gdp',           valueCol: 'gdp_value',             updatedCol: 'gdp_updated_at',           min: -15, max: 15 },
  unemployment:  { label: 'Unemployment rate SA (%)',       unit: '%',  live: true,  maxAgeDays: 100, prefix: 'unemployment',  valueCol: 'unemployment_value',    updatedCol: 'unemployment_updated_at',  min: 0,   max: 20 },
  real_estate:   { label: 'Real estate prices (YoY %)',     unit: '%',  live: false, maxAgeDays: 250, prefix: 'real_estate',   valueCol: 'real_estate_value',     updatedCol: 'real_estate_updated_at',   min: -30, max: 30 },
  exchange_rate: { label: 'EUR/CHF (CHF per EUR)',          unit: '',   live: true,  maxAgeDays: 5,   prefix: 'exchange_rate', valueCol: 'exchange_rate_value',   updatedCol: 'exchange_rate_updated_at', min: 0.5, max: 2 },
  ecb_rate:      { label: 'ECB deposit rate (%)',           unit: '%',  live: true,  maxAgeDays: 7,   prefix: 'ecb',           valueCol: 'ecb_rate_value',        updatedCol: 'ecb_updated_at',           min: -2,  max: 15, extraCols: ['ecb_stance'] },
  fed_rate:      { label: 'Fed funds upper target (%)',     unit: '%',  live: true,  maxAgeDays: 7,   prefix: 'fed',           valueCol: 'fed_rate_value',        updatedCol: 'fed_updated_at',           min: 0,   max: 20, extraCols: ['fed_stance'] },
  saron_futures: { label: 'SARON 3M futures price',         unit: '',   live: false, maxAgeDays: 7,   prefix: 'saron',         valueCol: 'saron_futures_price',   updatedCol: 'saron_updated_at',         min: 95,  max: 105, extraCols: ['market_implied_rate'] },
};

// The seven stance strings. /api/international-rates maps each one to a score,
// so keep both places in sync.
export const STANCES = [
  'hike_aggressive',
  'hike_moderate',
  'hold_hawkish_bias',
  'hold_neutral',
  'hold_dovish_bias',
  'cut_moderate',
  'cut_aggressive',
];

// Human-readable stance labels, shared by the cards and the manual form.
export const STANCE_LABELS = {
  hike_aggressive: 'Hiking aggressively (>50bp in 90 days)',
  hike_moderate: 'Hiking (10–50bp in 90 days)',
  hold_hawkish_bias: 'Holding, hawkish bias',
  hold_neutral: 'On hold',
  hold_dovish_bias: 'Holding, dovish bias',
  cut_moderate: 'Cutting (10–50bp in 90 days)',
  cut_aggressive: 'Cutting aggressively (>50bp in 90 days)',
};
