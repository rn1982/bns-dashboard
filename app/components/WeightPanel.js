'use client';
// "What drives the forecast": one row per indicator with a weight slider, its
// share of the model, its score and its contribution to the global score.
// Weights are any numbers 0–100; computeForecast normalises them to 100%.
import { useState } from 'react';
import { WEIGHTS, LABELS, THRESHOLDS } from '../lib/model';

// Bars are drawn on a ±2 scale (the score range), centred on 0.
function ContributionBar({ value }) {
  if (value === null) return <span className="text-xs text-gray-400">no data</span>;
  const pct = Math.min(Math.abs(value) / 2, 1) * 50;
  const color = value > 0 ? 'bg-red-500' : value < 0 ? 'bg-green-600' : 'bg-gray-400';
  return (
    <div className="relative h-2.5 w-full rounded bg-gray-100" title={`${value > 0 ? '+' : ''}${value.toFixed(2)}`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300" />
      <div
        className={`absolute inset-y-0 ${color} rounded`}
        style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
      />
    </div>
  );
}

// The contribution bars are always shown; the sliders only after "Adjust weights"
// (or when custom weights are active, so they can't be forgotten).
export default function WeightPanel({ weights, onChange, onReset, forecast, isCustom }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const [open, setOpen] = useState(false);
  const editing = open || isCustom;
  return (
    <section className="mb-6 bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-bold">What drives the forecast</h2>
          <p className="text-xs text-gray-500">
            Red pushes towards HIKE, green towards CUT. Verdict thresholds: ±{THRESHOLDS.moderate} moderate, ±{THRESHOLDS.strong} strong.
            {editing && ' Drag a slider to change how much an indicator counts; shares always add up to 100%.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isCustom && (
            <button
              type="button"
              onClick={() => { onReset(); setOpen(false); }}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              ↺ Reset to backtested weights
            </button>
          )}
          {!isCustom && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={editing}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              {editing ? 'Done' : '⚖ Adjust weights'}
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        <div className="hidden sm:grid grid-cols-12 gap-3 pb-1 text-xs font-semibold text-gray-500">
          <span className="col-span-3">Indicator</span>
          <span className={editing ? 'col-span-4' : 'hidden'}>Weight</span>
          <span className="col-span-1 text-right">Share</span>
          <span className="col-span-1 text-right">Score</span>
          <span className={editing ? 'col-span-3' : 'col-span-7'}>Contribution</span>
        </div>
        {Object.keys(WEIGHTS).map(k => {
          const c = forecast?.contributions?.[k] || { weight: 0, score: null, contribution: null };
          const changed = Math.abs(weights[k] - WEIGHTS[k] * 100) > 1e-9;
          return (
            <div key={k} className={`grid grid-cols-12 gap-x-3 gap-y-1 items-center text-sm ${editing ? 'py-2' : 'py-1'}`}>
              <label htmlFor={`w-${k}`} className="col-span-8 sm:col-span-3 font-medium">
                {LABELS[k]}
                {editing && <span className="ml-1 text-xs font-normal text-gray-400">(model {Math.round(WEIGHTS[k] * 100)}%)</span>}
              </label>
              <span className={`col-span-4 sm:hidden text-right tabular-nums ${changed ? 'text-blue-700 font-semibold' : ''}`}>
                {total > 0 ? Math.round(c.weight * 100) : 0}%
              </span>
              {editing && <input
                id={`w-${k}`}
                type="range"
                min="0"
                max="60"
                step="1"
                value={weights[k]}
                onChange={e => onChange(k, Number(e.target.value))}
                className="col-span-12 sm:col-span-4 accent-blue-600"
              />}
              <span className={`hidden sm:block col-span-1 text-right tabular-nums ${changed ? 'text-blue-700 font-semibold' : ''}`}>
                {total > 0 ? Math.round(c.weight * 100) : 0}%
              </span>
              <span className="col-span-2 sm:col-span-1 sm:text-right tabular-nums text-gray-700">
                {c.score === null ? '—' : c.score > 0 ? `+${c.score}` : c.score}
              </span>
              <div className={`col-span-10 ${editing ? 'sm:col-span-3' : 'sm:col-span-7'} flex items-center gap-2`}>
                <ContributionBar value={c.contribution} />
                <span className="w-12 text-right text-xs tabular-nums text-gray-500">
                  {c.contribution === null ? '' : `${c.contribution > 0 ? '+' : ''}${c.contribution.toFixed(2)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {total === 0 && <p className="mt-2 text-sm text-red-700">All weights are 0: no forecast. Move a slider or reset.</p>}
    </section>
  );
}
