'use client';
import { useState } from 'react';
import HistoryChart from './HistoryChart';

// One indicator: value, score, and where the number comes from.
// `data` is what the reader route returned: { value, score, meta, ... } or { error, meta }.

const BADGE = {
  live: { text: 'Live', cls: 'bg-green-100 text-green-800 border-green-300' },
  manual: { text: 'Manual', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  stale: { text: 'Stale', cls: 'bg-amber-100 text-amber-900 border-amber-400' },
  missing: { text: 'Missing', cls: 'bg-red-100 text-red-800 border-red-300' },
  error: { text: 'Error', cls: 'bg-red-100 text-red-800 border-red-300' },
};

export function FreshnessBadge({ meta, status }) {
  const s = status || meta?.status || 'error';
  const b = BADGE[s] || BADGE.error;
  // "Stale · manual" tells the user they typed it in themselves and should refresh it.
  const suffix = s === 'stale' && meta?.origin && meta.origin !== 'unknown' ? ` · ${meta.origin}` : '';
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${b.cls}`}
      title={meta?.reason || ''}
    >
      {b.text}{suffix}
    </span>
  );
}

export function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scoreStyle(score) {
  if (score > 0) return { text: 'text-red-700', border: 'border-red-400', label: 'hawkish' };
  if (score < 0) return { text: 'text-green-700', border: 'border-green-400', label: 'dovish' };
  return { text: 'text-gray-600', border: 'border-gray-400', label: 'neutral' };
}

// Drops the manual value and fetches the live source right away.
export function RevertButton({ onRevert }) {
  const [state, setState] = useState({ busy: false, error: null });
  async function click() {
    setState({ busy: true, error: null });
    try {
      await onRevert();
      setState({ busy: false, error: null });
    } catch (e) {
      setState({ busy: false, error: e.message });
    }
  }
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={click}
        disabled={state.busy}
        className="text-xs font-medium bg-white border border-blue-300 text-blue-800 px-2.5 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
      >
        {state.busy ? 'Fetching live data…' : '↺ Revert to live'}
      </button>
      {state.error && <p className="text-red-700 mt-1">{state.error}</p>}
    </div>
  );
}

export default function IndicatorCard({ title, weight, data, format = v => String(v), subtitle, onRevert, historyKey, historyFrom }) {
  const meta = data?.meta;
  const failed = !data || data.error;
  const status = failed ? (meta?.status === 'missing' ? 'missing' : 'error') : meta?.status;
  const style = failed ? { text: 'text-gray-500', border: 'border-red-400' } : scoreStyle(data.score);
  const isStale = status === 'stale';

  return (
    <div className={`bg-white rounded-lg shadow p-5 border-l-4 ${isStale ? 'border-amber-400' : style.border} flex flex-col`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          {title}
          {weight !== undefined && <span className="ml-1 text-xs font-normal text-gray-500">({Math.round(weight * 100)}%)</span>}
        </h3>
        <FreshnessBadge meta={meta} status={status} />
      </div>

      {failed ? (
        <div className="flex-1">
          <p className="text-gray-700 text-sm">{data?.error || 'Could not load this indicator'}</p>
          <p className="text-xs text-gray-500 mt-2">
            Left out of the forecast. You can enter it in <strong>Manual Data Update</strong>.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          <p className="text-2xl font-bold text-blue-700">{format(data.value)}</p>
          {subtitle && <p className="text-sm text-gray-700 mt-1">{subtitle}</p>}
          <p className={`text-sm font-semibold mt-2 ${style.text}`}>
            Score: {data.score > 0 ? `+${data.score}` : data.score} <span className="font-normal">({style.label})</span>
          </p>
        </div>
      )}

      {historyKey && (
        <div className="mt-3">
          <HistoryChart indicator={historyKey} from={historyFrom} format={format} />
        </div>
      )}

      {meta && (
        <dl className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
          {meta.observedAt && <div><dt className="inline">Data for: </dt><dd className="inline text-gray-700">{formatDate(meta.observedAt)}</dd></div>}
          {meta.source && <div><dt className="inline">Source: </dt><dd className="inline text-gray-700">{meta.source}</dd></div>}
          {meta.updatedAt && <div><dt className="inline">Saved: </dt><dd className="inline">{formatDateTime(meta.updatedAt)}</dd></div>}
          {meta.reason && <div className={isStale ? 'text-amber-800 font-medium' : ''}>{meta.reason}</div>}
          {!meta.hasLiveSource && <div>No live source: manual entry only.</div>}
          {meta.hasLiveSource && meta.origin === 'manual' && onRevert && <RevertButton onRevert={() => onRevert(meta.key)} />}
        </dl>
      )}
    </div>
  );
}
