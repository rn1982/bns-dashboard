// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshness, toDateString, ageInDays } from './freshness.js';
import { computeForecast, verdictFromScore, WEIGHTS } from './model.js';

const NOW = new Date('2026-11-13T09:00:00Z');

// ---------- freshness ----------

test('fresh live value → live', () => {
  const f = freshness({ value: 1.5, observedAt: '2026-10-01', origin: 'live', maxAgeDays: 70 }, NOW);
  assert.equal(f.status, 'live');
  assert.equal(f.ageDays, 43);
});

test('fresh manual value → manual', () => {
  const f = freshness({ value: 3.1, observedAt: '2026-11-01', origin: 'manual', maxAgeDays: 250 }, NOW);
  assert.equal(f.status, 'manual');
});

test('old value → stale, whatever its origin', () => {
  const live = freshness({ value: 0.93, observedAt: '2026-11-01', origin: 'live', maxAgeDays: 5 }, NOW);
  const manual = freshness({ value: 0.93, observedAt: '2026-11-01', origin: 'manual', maxAgeDays: 5 }, NOW);
  assert.equal(live.status, 'stale');
  assert.equal(manual.status, 'stale');
  assert.equal(manual.origin, 'manual');
  assert.match(live.reason, /12 days old/);
});

test('exactly maxAgeDays old is still fresh', () => {
  assert.equal(freshness({ value: 1, observedAt: '2026-11-06', origin: 'live', maxAgeDays: 7 }, NOW).status, 'live');
  assert.equal(freshness({ value: 1, observedAt: '2026-11-05', origin: 'live', maxAgeDays: 7 }, NOW).status, 'stale');
});

test('null value → missing (the old code scored it as if it were 0)', () => {
  assert.equal(freshness({ value: null, observedAt: null, origin: null, maxAgeDays: 7 }, NOW).status, 'missing');
});

test('legacy row (no observed_at, no origin) uses the write time and is not called live', () => {
  const f = freshness({ value: 2, observedAt: null, updatedAt: '2026-11-10T08:00:00Z', origin: null, maxAgeDays: 7 }, NOW);
  assert.equal(f.status, 'manual');
  assert.equal(f.legacy, true);
  assert.equal(f.origin, 'unknown');
});

test('no date at all → stale', () => {
  assert.equal(freshness({ value: 2, observedAt: null, updatedAt: null, origin: 'live', maxAgeDays: 7 }, NOW).status, 'stale');
});

test('toDateString handles strings, timestamps and local-midnight Dates', () => {
  assert.equal(toDateString('2026-10-01'), '2026-10-01');
  assert.equal(toDateString('2026-10-01T00:00:00.000Z'), '2026-10-01');
  assert.equal(toDateString(new Date(2026, 9, 1)), '2026-10-01'); // what node-postgres returns for DATE
  assert.equal(toDateString(null), null);
  assert.equal(toDateString('garbage'), null);
  assert.equal(ageInDays('2026-11-13', NOW), 0);
});

// ---------- model ----------

const ALL = { inflation: 1, realEstate: 0, exchangeRate: -2, ecb: 1, gdp: 1, unemployment: 0, fed: 0 };

test('weights sum to 1', () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('all indicators → same score as the old page.js formula', () => {
  const f = computeForecast(ALL);
  // 0.30 + 0 - 0.30 + 0.15 + 0.10 + 0 + 0 = 0.25
  assert.equal(f.score, 0.25);
  assert.equal(f.partial, false);
  assert.equal(f.coverage, 1);
  assert.equal(f.verdict.direction, 'HOLD');
});

test('missing indicator → partial verdict with re-scaled weights', () => {
  const f = computeForecast({ ...ALL, realEstate: null });
  assert.equal(f.partial, true);
  assert.deepEqual(f.missing, ['realEstate']);
  assert.equal(f.coverage, 0.8);
  assert.equal(f.score, 0.313); // 0.25 / 0.8
});

test('too little data → no verdict', () => {
  const f = computeForecast({ inflation: 2, fed: 1 }); // 35% of the weight
  assert.equal(f.verdict, null);
  assert.equal(f.score, null);
});

test('verdict thresholds', () => {
  assert.equal(verdictFromScore(1.0).strength, 'strong');
  assert.equal(verdictFromScore(0.35).direction, 'HIKE');
  assert.equal(verdictFromScore(0.349).direction, 'HOLD');
  assert.equal(verdictFromScore(-0.35).direction, 'CUT');
  assert.equal(verdictFromScore(-0.349).direction, 'HOLD');
  assert.equal(verdictFromScore(-1.0).strength, 'strong');
});

// ---------- readIndicator (DB row → value + meta), no database needed ----------
import { readIndicator } from './db.js';

test('readIndicator reads value, provenance and badge from a row', () => {
  const row = {
    inflation_value: '1.5', // numeric columns can come back as strings
    inflation_observed_at: new Date(2026, 9, 1),
    inflation_origin: 'live',
    inflation_source: 'FSO CPI (cc-d-05.02.08, YoY)',
    inflation_updated_at: new Date('2026-11-13T08:00:00Z'),
  };
  const { value, meta } = readIndicator(row, 'inflation', NOW);
  assert.equal(value, 1.5);
  assert.equal(meta.status, 'live');
  assert.equal(meta.observedAt, '2026-10-01');
  assert.equal(meta.source, 'FSO CPI (cc-d-05.02.08, YoY)');
  assert.equal(meta.hasLiveSource, true);
});

test('readIndicator: empty column → missing; manual-only indicator says so', () => {
  const { value, meta } = readIndicator({ real_estate_value: null }, 'real_estate', NOW);
  assert.equal(value, null);
  assert.equal(meta.status, 'missing');
  assert.equal(meta.hasLiveSource, false);
});
