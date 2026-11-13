// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quarterToDate, dateToQuarter, yoyFromQuarterlyLevels } from './snb.js';

test('quarter <-> first day of the quarter', () => {
  assert.equal(quarterToDate('2026-Q1'), '2026-01-01');
  assert.equal(quarterToDate('2026-Q2'), '2026-04-01');
  assert.equal(quarterToDate('2026-Q4'), '2026-10-01');
  assert.equal(dateToQuarter('2026-03-31'), '2026-Q1');
  assert.equal(dateToQuarter('2026-04-01'), '2026-Q2');
  assert.equal(dateToQuarter('2026-12-15'), '2026-Q4');
});

test('GDP levels -> year-on-year growth, compared with the same quarter a year earlier', () => {
  const levels = [
    { date: '2024-Q1', value: 100 },
    { date: '2024-Q2', value: 101 },
    { date: '2024-Q3', value: 102 },
    { date: '2024-Q4', value: 103 },
    { date: '2025-Q1', value: 102 }, // +2% vs 2024-Q1
    { date: '2025-Q2', value: 101 }, //  0% vs 2024-Q2 (NOT vs the previous quarter)
  ];
  assert.deepEqual(yoyFromQuarterlyLevels(levels), [
    { date: '2025-01-01', value: 2 },
    { date: '2025-04-01', value: 0 },
  ]);
});

test('fewer than 5 quarters -> no growth point', () => {
  assert.deepEqual(yoyFromQuarterlyLevels([{ date: '2025-Q1', value: 1 }]), []);
});
