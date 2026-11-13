'use client';
// Manual correction form. Shows the current value and its badge next to each
// field; only the fields you fill in are sent. "Revert to live" drops a manual
// value and fetches the live source right away.
import { useState } from 'react';
import { FreshnessBadge, formatDate } from './IndicatorCard';
import { STANCES, STANCE_LABELS } from '../lib/indicators';

// field name sent to /api/manual-data-update, label, input step, example
const NUMBER_FIELDS = [
  { field: 'inflation', label: 'Swiss CPI inflation, YoY (%)', step: '0.01', example: '0.5' },
  { field: 'snbRate', label: 'SNB policy rate (%)', step: '0.25', example: '0.00' },
  { field: 'gdp', label: 'Swiss real GDP growth, YoY (%)', step: '0.01', example: '1.2' },
  { field: 'unemployment', label: 'Unemployment rate SA (%)', step: '0.01', example: '2.9' },
  { field: 'realEstate', label: 'Real estate prices, YoY (%)', step: '0.1', example: '3.5' },
  { field: 'exchangeRate', label: 'EUR/CHF (CHF per 1 EUR)', step: '0.0001', example: '0.9300' },
];

const BANKS = [
  { rateField: 'ecbRate', stanceField: 'ecbStance', label: 'ECB deposit rate (%)', example: '2.00' },
  { rateField: 'fedRate', stanceField: 'fedStance', label: 'Fed funds upper target (%)', example: '4.00' },
];

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  inflation: '', snbRate: '', gdp: '', unemployment: '', realEstate: '', exchangeRate: '',
  saronFutures: '', ecbRate: '', ecbStance: '', fedRate: '', fedStance: '', nextMeeting: '',
};

function Current({ current }) {
  if (!current) return null;
  const { value, meta } = current;
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 flex-wrap">
      <span>Now: <strong className="text-gray-700">{value ?? '—'}</strong></span>
      {meta && <FreshnessBadge meta={meta} />}
      {meta?.observedAt && <span>for {formatDate(meta.observedAt)}</span>}
    </span>
  );
}

/**
 * current: { [field]: { value, meta } } built by app/page.js from the reader routes.
 * authRequired: the server has MANUAL_UPDATE_SECRET set.
 */
export default function ManualDataInput({ current = {}, nextMeeting, authRequired, onUpdate }) {
  const [form, setForm] = useState(EMPTY);
  const [observedAt, setObservedAt] = useState(today());
  const [adminKey, setAdminKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function send(body) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/manual-data-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminKey && { 'x-admin-key': adminKey }) },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || `HTTP ${res.status}`);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    if (!Object.keys(body).length) {
      setMessage({
        ok: false,
        text: observedAt !== today()
          ? 'The observation date only applies to values you type in. To re-date a value, type it again (e.g. 4.3) with the new date.'
          : 'Fill in at least one field.',
      });
      return;
    }
    try {
      const r = await send({ ...body, observedAt });
      setMessage({ ok: true, text: `Saved: ${r.updatedFields.join(', ')}` });
      setForm(EMPTY);
      onUpdate?.();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }

  async function revert(key, label) {
    try {
      const r = await send({ revert: [key] });
      const v = r.reverted[key];
      setMessage({ ok: true, text: `${label}: back to live (${v.value}, for ${formatDate(v.observedAt)})` });
      onUpdate?.();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }

  // Indicators with a live source that currently hold a manual value.
  const revertable = Object.values(current)
    .map(c => c?.meta)
    .filter(m => m && m.hasLiveSource && m.origin === 'manual');

  const input = 'w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-1">Manual data update</h3>
      <p className="text-sm text-gray-600 mb-4">
        Fill in only what you want to change. A manual value is kept until a live source publishes a
        <em> newer</em> observation, or until you revert it.
      </p>

      {revertable.length > 0 && (
        <div className="mb-5 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-2">Manual values that have a live source:</p>
          <div className="flex flex-wrap gap-2">
            {revertable.map(m => (
              <button
                key={m.key}
                type="button"
                disabled={busy}
                onClick={() => revert(m.key, m.label)}
                className="text-sm bg-white border border-blue-300 text-blue-800 px-3 py-1 rounded hover:bg-blue-100 disabled:opacity-50"
              >
                ↺ {m.label}: revert to live
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 p-3 bg-gray-50 rounded border border-gray-200">
          <label className="block md:w-1/2">
            <span className="block text-sm font-medium mb-1">📅 Next SNB meeting date</span>
            <input type="date" value={form.nextMeeting} min={today()} onChange={set('nextMeeting')} className={input} />
            <span className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              Now: <strong className="text-gray-700">{nextMeeting?.date ? formatDate(nextMeeting.date) : '—'}</strong>
              {nextMeeting && <FreshnessBadge meta={{ reason: nextMeeting.reason }} status={nextMeeting.status} />}
              <span>· can be saved on its own</span>
            </span>
          </label>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-100">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Period the numbers below refer to (not the meeting date)</span>
            <input type="date" value={observedAt} max={today()} onChange={e => setObservedAt(e.target.value)} className={input} required />
            <span className="block text-xs text-gray-500 mt-1">
              Applies to every value you type below in this save (e.g. 2026-07-01 for a Q3 figure). To re-date a stored value, type the value again.
            </span>
          </label>
          {authRequired && (
            <label className="block">
              <span className="block text-sm font-medium mb-1">Admin key</span>
              <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} className={input} autoComplete="current-password" />
              <span className="block text-xs text-gray-500 mt-1">Required: this server has MANUAL_UPDATE_SECRET set.</span>
            </label>
          )}
        </div>

        {NUMBER_FIELDS.map(f => (
          <label key={f.field} className="block">
            <span className="block text-sm font-medium mb-1">{f.label}</span>
            <input type="number" step={f.step} value={form[f.field]} onChange={set(f.field)} className={input} placeholder={`e.g. ${f.example}`} />
            <Current current={current[f.field]} />
          </label>
        ))}

        {BANKS.map(b => (
          <div key={b.rateField} className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-sm font-medium mb-1">{b.label}</span>
              <input type="number" step="0.05" value={form[b.rateField]} onChange={set(b.rateField)} className={input} placeholder={`e.g. ${b.example}`} />
              <Current current={current[b.rateField]} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Stance (last 90 days)</span>
              <select value={form[b.stanceField]} onChange={set(b.stanceField)} className={input}>
                <option value="">— keep current —</option>
                {STANCES.map(s => <option key={s} value={s}>{STANCE_LABELS[s]}</option>)}
              </select>
              {current[b.rateField]?.stance && (
                <span className="block text-xs text-gray-500 mt-1">Now: {current[b.rateField].stance}</span>
              )}
            </label>
          </div>
        ))}

        <label className="block">
          <span className="block text-sm font-medium mb-1">SARON 3M futures price (Eurex FSR3)</span>
          <input type="number" step="0.005" value={form.saronFutures} onChange={set('saronFutures')} className={input} placeholder="e.g. 99.950" />
          <span className="block text-xs text-gray-500 mt-1">
            99.950 = 0.050% implied rate. Source:{' '}
            <a href="https://www.eurex.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">eurex.com</a> → search FSR3.
          </span>
          <Current current={current.saronFutures} />
        </label>

        <div className="md:col-span-2 flex items-center gap-4 pt-2">
          <button type="submit" disabled={busy} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`} role="status">
              {message.ok ? '✓ ' : '✗ '}{message.text}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
