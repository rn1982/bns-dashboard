// Meeting replay: what would the model have said before each past SNB meeting,
// and what did the SNB actually do? Pure (no DB): /api/replay feeds it the history
// series and the page runs computeForecast on the scores (so the weight sliders apply).
import { stanceFromSeries } from './stance.js';
import {
  scoreInflation, scoreRealEstate, scoreExchangeRate, scoreGdp, scoreUnemployment, scoreStance,
} from './model.js';

// SNB quarterly monetary policy assessments (decision announced on this day, new rate
// effective the next day). From June 2019, when the SNB policy rate was introduced.
// Checked against the rate changes in the SNB data portal (snbgwdzid) and snb.ch.
export const SNB_MEETINGS = [
  '2019-09-19', '2019-12-12',
  '2020-03-19', '2020-06-18', '2020-09-24', '2020-12-17',
  '2021-03-25', '2021-06-17', '2021-09-23', '2021-12-16',
  '2022-03-24', '2022-06-16', '2022-09-22', '2022-12-15',
  '2023-03-23', '2023-06-22', '2023-09-21', '2023-12-14',
  '2024-03-21', '2024-06-20', '2024-09-26', '2024-12-12',
  '2025-03-20', '2025-06-19', '2025-09-25', '2025-12-11',
  '2026-03-19', '2026-06-18', '2026-09-24',
  // Add each new meeting here once it has happened (next: 2026-12-10).
];

// Days between an observation's date and the day it is public. Without this the
// replay would "know" data the SNB did not have yet. Observation dates are the
// first day of the period (CPI for September = 2026-09-01, published early October).
export const PUBLICATION_LAG_DAYS = {
  inflation: 35,     // FSO publishes CPI in the first days of the next month
  unemployment: 40,  // SECO publishes ~1 week into the next month
  gdp: 155,          // SECO: ~2 months after quarter end (dated at quarter start)
  real_estate: 90,   // quarterly, manual entries only
  exchange_rate: 1,  // daily
  ecb_rate: 1,
  fed_rate: 1,
  snb_rate: 0,
};

// Model key (as in WEIGHTS) -> history key (as in indicators.js) + how to score it.
export const REPLAY_INPUTS = {
  inflation:    { history: 'inflation',     score: scoreInflation },
  realEstate:   { history: 'real_estate',   score: scoreRealEstate },
  exchangeRate: { history: 'exchange_rate', score: scoreExchangeRate },
  ecb:          { history: 'ecb_rate',      stance: true },
  gdp:          { history: 'gdp',           score: scoreGdp },
  unemployment: { history: 'unemployment',  score: scoreUnemployment },
  fed:          { history: 'fed_rate',      stance: true },
};

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Points that were public on `asOf` (observation date + lag <= asOf). Input ascending. */
export function knownAsOf(points, asOf, lagDays) {
  const cutoff = addDays(asOf, -lagDays);
  return points.filter(p => p.date <= cutoff);
}

/** What the SNB did: rate before the announcement vs rate a week later. */
export function actualDecision(snbPoints, meetingDate) {
  const before = knownAsOf(snbPoints, addDays(meetingDate, -1), 0).pop();
  const after = knownAsOf(snbPoints, addDays(meetingDate, 7), 0).pop();
  if (!before || !after) return null;
  const changeBp = Math.round((after.value - before.value) * 100);
  return {
    before: before.value,
    after: after.value,
    changeBp,
    direction: changeBp > 0 ? 'HIKE' : changeBp < 0 ? 'CUT' : 'HOLD',
  };
}

/**
 * One meeting. histories: { [historyKey]: [{ date, value }] ascending }.
 * The model sees only data public on the day BEFORE the meeting.
 */
export function replayMeeting(histories, meetingDate) {
  const asOf = addDays(meetingDate, -1);
  const inputs = {};
  for (const [key, def] of Object.entries(REPLAY_INPUTS)) {
    const known = knownAsOf(histories[def.history] || [], asOf, PUBLICATION_LAG_DAYS[def.history]);
    const last = known[known.length - 1];
    if (!last) {
      inputs[key] = { value: null, observedAt: null, score: null };
      continue;
    }
    if (def.stance) {
      try {
        const st = stanceFromSeries(known);
        inputs[key] = { value: last.value, observedAt: last.date, stance: st.stance, score: scoreStance(st.stance) };
      } catch {
        inputs[key] = { value: last.value, observedAt: last.date, score: null };
      }
    } else {
      inputs[key] = { value: last.value, observedAt: last.date, score: def.score(last.value) };
    }
  }
  return { date: meetingDate, asOf, actual: actualDecision(histories.snb_rate || [], meetingDate), inputs };
}

export function replayAll(histories, meetings = SNB_MEETINGS) {
  return meetings.map(d => replayMeeting(histories, d));
}

/**
 * Hit rate of a set of forecasts against the actual decisions.
 * rows: [{ actual: { direction }, forecast: { verdict: { direction } | null } }]
 */
export function hitRate(rows) {
  const scored = rows.filter(r => r.actual && r.forecast?.verdict);
  const hits = scored.filter(r => r.forecast.verdict.direction === r.actual.direction).length;
  const moves = scored.filter(r => r.actual.direction !== 'HOLD');
  const moveHits = moves.filter(r => r.forecast.verdict.direction === r.actual.direction).length;
  return { total: scored.length, hits, moves: moves.length, moveHits };
}
