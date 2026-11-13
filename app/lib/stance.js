// Turn a policy-rate history into one of the seven stance strings.
//
// observations: [{ date: 'YYYY-MM-DD', value: number }] in any order.
// We compare the latest value with the value on (or just before) latest date - lookbackDays.
// Index-based comparisons do not work: daily series have ~3 entries for 3 days,
// not 3 months, which is why the old code always returned 'hold_neutral'.

export function stanceFromSeries(observations, lookbackDays = 90) {
  const obs = observations
    .filter(o => o && typeof o.value === 'number' && Number.isFinite(o.value) && o.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (obs.length < 2) throw new Error('Not enough observations to compute a stance');

  const latest = obs[obs.length - 1];
  const cutoff = new Date(`${latest.date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const past = obs.filter(o => o.date <= cutoffStr).pop();
  if (!past) {
    throw new Error(`History starts ${obs[0].date}, need data on or before ${cutoffStr}`);
  }

  // Round to avoid floating-point noise like 0.25000000001.
  const change = Math.round((latest.value - past.value) * 1000) / 1000;

  let stance = 'hold_neutral';
  if (change > 0.5) stance = 'hike_aggressive';
  else if (change >= 0.1) stance = 'hike_moderate';
  else if (change > 0) stance = 'hold_hawkish_bias';
  else if (change < -0.5) stance = 'cut_aggressive';
  else if (change <= -0.1) stance = 'cut_moderate';
  else if (change < 0) stance = 'hold_dovish_bias';

  return { stance, change, from: past, to: latest };
}
