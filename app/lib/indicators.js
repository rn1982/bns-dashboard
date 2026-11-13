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

export const INDICATORS = {
  inflation:     { prefix: 'inflation',     valueCol: 'inflation_value',       updatedCol: 'inflation_updated_at',     min: -5,  max: 15 },
  snb_rate:      { prefix: 'snb',           valueCol: 'snb_policy_rate_value', updatedCol: 'snb_updated_at',           min: -2,  max: 10 },
  gdp:           { prefix: 'gdp',           valueCol: 'gdp_value',             updatedCol: 'gdp_updated_at',           min: -15, max: 15 },
  unemployment:  { prefix: 'unemployment',  valueCol: 'unemployment_value',    updatedCol: 'unemployment_updated_at',  min: 0,   max: 20 },
  real_estate:   { prefix: 'real_estate',   valueCol: 'real_estate_value',     updatedCol: 'real_estate_updated_at',   min: -30, max: 30 },
  exchange_rate: { prefix: 'exchange_rate', valueCol: 'exchange_rate_value',   updatedCol: 'exchange_rate_updated_at', min: 0.5, max: 2 },
  ecb_rate:      { prefix: 'ecb',           valueCol: 'ecb_rate_value',        updatedCol: 'ecb_updated_at',           min: -2,  max: 15, extraCols: ['ecb_stance'] },
  fed_rate:      { prefix: 'fed',           valueCol: 'fed_rate_value',        updatedCol: 'fed_updated_at',           min: 0,   max: 20, extraCols: ['fed_stance'] },
  saron_futures: { prefix: 'saron',         valueCol: 'saron_futures_price',   updatedCol: 'saron_updated_at',         min: 95,  max: 105, extraCols: ['market_implied_rate'] },
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
