// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knownAsOf, actualDecision, replayMeeting, hitRate, addDays, SNB_MEETINGS } from './replay.js';
import { scoreInflation, scoreExchangeRate, scoreGdp, scoreUnemployment, scoreRealEstate, scoreStance } from './model.js';

test('scoring rules: same boundaries as the old route code', () => {
  assert.deepEqual([2.6, 2.5, 1.8, 0.7, 0, -0.1].map(scoreInflation), [2, 1, 1, 0, -1, -2]);
  assert.deepEqual([1.01, 1.0, 0.98, 0.96, 0.94, 0.93].map(scoreExchangeRate), [2, 1, 1, 0, -1, -2]);
  assert.deepEqual([2.6, 2.1, 1.0, 0, -0.1].map(scoreGdp), [2, 1, 0, -1, -2]);
  assert.deepEqual([1.9, 2.4, 3.5, 4.5, 4.6].map(scoreUnemployment), [2, 1, 0, -1, -2]);
  assert.deepEqual([6.1, 4.1, 2, 0, -1].map(scoreRealEstate), [2, 1, 0, -1, -2]);
  assert.equal(scoreStance('hike_aggressive'), 2);
  assert.equal(scoreStance('nonsense'), null);
});

test('publication lag: September CPI (dated 09-01) is not known on 09-30, known on 10-06', () => {
  const pts = [{ date: '2026-08-01', value: 0.8 }, { date: '2026-09-01', value: 1.0 }];
  assert.equal(knownAsOf(pts, '2026-09-30', 35).pop().value, 0.8);
  assert.equal(knownAsOf(pts, '2026-10-06', 35).pop().value, 1.0);
});

test('actual decision: June 2022 hike of 50bp (effective the next day)', () => {
  const snb = [{ date: '2022-06-15', value: -0.75 }, { date: '2022-06-16', value: -0.75 }, { date: '2022-06-17', value: -0.25 }];
  assert.deepEqual(actualDecision(snb, '2022-06-16'), { before: -0.75, after: -0.25, changeBp: 50, direction: 'HIKE' });
});

test('replayMeeting: scores from data known the day before; stance from the 90-day change', () => {
  const daily = (from, days, v) => Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), value: typeof v === 'function' ? v(i) : v }));
  const h = {
    inflation: [{ date: '2022-04-01', value: 2.5 }, { date: '2022-05-01', value: 2.9 }], // May CPI public ~June 5
    exchange_rate: daily('2022-01-01', 170, 1.03),
    ecb_rate: daily('2022-01-01', 170, i => (i < 100 ? -0.5 : 0)),   // +50bp within 90 days
    fed_rate: daily('2022-01-01', 170, 1),
    gdp: [{ date: '2022-01-01', value: 4.4 }],                        // Q1 public ~June 5
    unemployment: [{ date: '2022-04-01', value: 2.2 }],
    snb_rate: daily('2022-06-01', 30, i => (i < 16 ? -0.75 : -0.25)),
  };
  const r = replayMeeting(h, '2022-06-16');
  assert.equal(r.inputs.inflation.value, 2.9);
  assert.equal(r.inputs.inflation.score, 2);
  assert.equal(r.inputs.exchangeRate.score, 2);
  assert.equal(r.inputs.ecb.stance, 'hike_moderate');
  assert.equal(r.inputs.fed.score, 0);
  assert.equal(r.inputs.realEstate.score, null); // no history -> left out
  assert.equal(r.actual.direction, 'HIKE');
});

test('hitRate counts direction matches, and separately the meetings with a move', () => {
  const row = (a, f) => ({ actual: { direction: a }, forecast: f ? { verdict: { direction: f } } : { verdict: null } });
  assert.deepEqual(hitRate([row('HIKE', 'HIKE'), row('HOLD', 'HIKE'), row('CUT', 'CUT'), row('HOLD', null)]),
    { total: 3, hits: 2, moves: 2, moveHits: 2 });
});

test('meeting list is sorted and on Thursdays', () => {
  assert.deepEqual([...SNB_MEETINGS].sort(), SNB_MEETINGS);
  for (const d of SNB_MEETINGS) assert.equal(new Date(`${d}T00:00:00Z`).getUTCDay(), 4, d);
});
