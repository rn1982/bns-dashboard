'use client';
// Past SNB meetings: the model's verdict from the data public before each meeting
// (scores from /api/replay, weights from the page) vs what the SNB actually did.
import { useEffect, useMemo, useState } from 'react';
import { computeForecast, LABELS } from '../lib/model';
import { hitRate } from '../lib/replay';
import { STANCE_LABELS } from '../lib/indicators';

const DIR_STYLE = {
  HIKE: 'bg-red-100 text-red-800',
  HOLD: 'bg-gray-100 text-gray-700',
  CUT: 'bg-green-100 text-green-800',
};

function Pill({ dir, children }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${DIR_STYLE[dir] || 'bg-gray-50 text-gray-400'}`}>{children}</span>;
}

const fmtDate = d => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const signed = (n, digits = 2) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

export default function MeetingReplay({ weights, isCustom }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  useEffect(() => {
    fetch('/api/replay', { cache: 'no-store' })
      .then(r => r.json())
      .then(b => (b.error ? setError(b.error) : setData(b)))
      .catch(e => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.meetings.map(m => ({
      ...m,
      forecast: computeForecast(Object.fromEntries(Object.entries(m.inputs).map(([k, v]) => [k, v.score])), weights),
    }));
  }, [data, weights]);

  if (error) return <p className="text-sm text-red-700">Replay unavailable: {error}</p>;
  if (!data) return <div className="h-40 rounded-lg bg-white shadow animate-pulse" />;

  const hr = hitRate(rows);
  const withActual = rows.filter(r => r.actual);
  const holds = withActual.filter(r => r.actual.direction === 'HOLD').length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Model right (all meetings)</p>
          <p className="text-2xl font-bold">{hr.hits} / {hr.total} <span className="text-base font-semibold text-gray-500">({pct(hr.hits, hr.total)}%)</span></p>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Benchmark: always say HOLD</p>
          <p className="text-2xl font-bold text-gray-600">{holds} / {withActual.length} <span className="text-base font-semibold">({pct(holds, withActual.length)}%)</span></p>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Moves caught (SNB hiked or cut)</p>
          <p className="text-2xl font-bold">{hr.moveHits} / {hr.moves} <span className="text-base font-semibold text-gray-500">({pct(hr.moveHits, hr.moves)}%)</span></p>
        </div>
      </div>
      {isCustom && <p className="text-xs text-blue-700 mb-2">Using your custom weights. Reset them to see the backtested model.</p>}

      <div className="text-sm">
        <div className="grid grid-cols-12 gap-2 pb-1 border-b border-gray-200 text-xs font-semibold text-gray-500">
          <span className="col-span-4 sm:col-span-3">Meeting</span>
          <span className="col-span-3 sm:col-span-3">SNB did</span>
          <span className="col-span-4 sm:col-span-4">Model said</span>
          <span className="col-span-1 sm:col-span-2 text-right">✓</span>
        </div>
        {[...rows].reverse().map(r => {
          const v = r.forecast.verdict;
          const hit = v && r.actual && v.direction === r.actual.direction;
          const open = openDate === r.date;
          return (
            <div key={r.date} className="border-b border-gray-100">
              <button
                type="button"
                onClick={() => setOpenDate(open ? null : r.date)}
                aria-expanded={open}
                className="w-full grid grid-cols-12 gap-2 py-2 items-center text-left hover:bg-gray-50"
              >
                <span className="col-span-4 sm:col-span-3">
                  <span className="text-gray-400 mr-1">{open ? '▾' : '▸'}</span>{fmtDate(r.date)}
                </span>
                <span className="col-span-3 sm:col-span-3">
                  {r.actual ? (
                    <Pill dir={r.actual.direction}>
                      {r.actual.direction}{r.actual.changeBp ? ` ${r.actual.changeBp > 0 ? '+' : ''}${r.actual.changeBp}bp` : ''}
                    </Pill>
                  ) : '—'}
                  {r.actual && <span className="hidden sm:inline text-xs text-gray-500 ml-1">→ {r.actual.after}%</span>}
                </span>
                <span className="col-span-4 sm:col-span-4">
                  {v ? <Pill dir={v.direction}>{v.direction}</Pill> : <span className="text-xs text-gray-400">not enough data</span>}
                  {v && <span className="text-xs text-gray-500 ml-1 tabular-nums">{signed(r.forecast.score)}</span>}
                </span>
                <span className={`col-span-1 sm:col-span-2 text-right font-bold ${hit ? 'text-green-700' : 'text-red-600'}`}>
                  {v && r.actual ? (hit ? '✓' : '✗') : ''}
                </span>
              </button>
              {open && (
                <div className="pb-3 pl-5 text-xs text-gray-600">
                  <p className="mb-1">Data the model had on {fmtDate(r.asOf)} (published by then):</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                    {Object.entries(r.inputs).map(([k, inp]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span>{LABELS[k]}</span>
                        <span className="tabular-nums text-gray-800">
                          {inp.value === null ? 'no data' : (
                            <>
                              {inp.stance ? STANCE_LABELS[inp.stance] : `${Number(inp.value.toFixed(k === 'exchangeRate' ? 4 : 2))}${k === 'exchangeRate' ? '' : '%'}`}
                              {inp.observedAt && !inp.stance && <span className="text-gray-400"> ({inp.observedAt.slice(0, 7)})</span>}
                              <span className={`ml-2 font-semibold ${inp.score > 0 ? 'text-red-700' : inp.score < 0 ? 'text-green-700' : ''}`}>
                                {inp.score === null ? '—' : inp.score > 0 ? `+${inp.score}` : inp.score}
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ul className="mt-3 text-xs text-gray-500 list-disc pl-4 space-y-0.5">
        {data.notes.map(n => <li key={n}>{n}</li>)}
        <li>Direction only: a 50bp hike called as &quot;moderate HIKE&quot; still counts as right.</li>
      </ul>
    </div>
  );
}
