'use client';

import { useState, useEffect, useCallback } from 'react';
import IndicatorCard, { FreshnessBadge, RevertButton, formatDate, formatDateTime } from './components/IndicatorCard';
import ManualDataInput from './components/ManualDataInput';
import { RANGES, rangeStart } from './components/HistoryChart';
import { WEIGHTS, LABELS, computeForecast, isBacktestedWeights } from './lib/model';
import WeightPanel from './components/WeightPanel';
import { STANCE_LABELS } from './lib/indicators';

const ROUTES = {
  inflation: '/api/inflation',
  realEstate: '/api/real-estate',
  exchangeRate: '/api/exchange-rate',
  economicHealth: '/api/economic-health',
  internationalRates: '/api/international-rates',
  marketExpectations: '/api/market-expectations',
  status: '/api/status',
};

// One failing route must not take the whole page down: each result is either
// the route's JSON or { error }.
async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    return res.ok || body.error ? body : { ...body, error: `HTTP ${res.status}` };
  } catch (e) {
    return { error: e.message };
  }
}

const pct = v => `${v}%`;

// Card order and how each card reads its data. Model keys match WEIGHTS;
// `history` is the indicator key in app/lib/indicators.js (used by /api/history).
const CARDS = [
  { key: 'inflation', history: 'inflation', get: d => d.inflation, format: pct },
  { key: 'realEstate', history: 'real_estate', get: d => d.realEstate, format: v => `${v}% YoY` },
  { key: 'exchangeRate', history: 'exchange_rate', get: d => d.exchangeRate, format: v => Number(v).toFixed(4) },
  { key: 'ecb', history: 'ecb_rate', stepped: true, get: d => d.internationalRates?.ecb, format: pct, subtitle: x => STANCE_LABELS[x?.stance] || x?.stance },
  { key: 'gdp', history: 'gdp', get: d => d.economicHealth?.gdp, format: pct },
  { key: 'unemployment', history: 'unemployment', get: d => d.economicHealth?.unemployment, format: pct },
  { key: 'fed', history: 'fed_rate', stepped: true, get: d => d.internationalRates?.fed, format: pct, subtitle: x => STANCE_LABELS[x?.stance] || x?.stance },
];

// Slider positions: the backtested weights in points (0.30 -> 30).
const DEFAULT_POINTS = Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, Math.round(v * 100)]));
// The user's slider positions are kept in THIS browser only (other viewers see the backtested model).
const WEIGHTS_STORAGE_KEY = 'snb-dashboard-weights-v1';

const VERDICT_STYLE = {
  'HIKE-strong': 'bg-red-200 text-red-900 border-red-400',
  'HIKE-moderate': 'bg-red-100 text-red-800 border-red-300',
  'HOLD-neutral': 'bg-gray-100 text-gray-800 border-gray-300',
  'CUT-moderate': 'bg-green-100 text-green-800 border-green-300',
  'CUT-strong': 'bg-green-200 text-green-900 border-green-400',
};

function CronBanner({ status }) {
  if (!status) return null;
  if (status.error) {
    return <div className="mb-4 p-3 rounded bg-red-50 border border-red-300 text-sm text-red-800">Database error: {status.error}</div>;
  }
  if (!status.lastCronRunAt) {
    return (
      <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-300 text-sm text-amber-900">
        The daily data refresh has not run yet with the new data layer. Values below may be old.
      </div>
    );
  }
  const ok = status.cronOk && !status.failures.length;
  return (
    <div className={`mb-4 p-3 rounded border text-sm ${ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
      Last automatic refresh: <strong>{formatDateTime(status.lastCronRunAt)}</strong>
      {ok ? ' — all live sources OK.' : (
        <>
          {' '}— failed: {status.failures.map(f => f.key).join(', ')}.
          <span className="block text-xs mt-1 opacity-80">{status.failures.map(f => `${f.key}: ${f.error}`).join(' · ')}</span>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const [allData, setAllData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showManualInput, setShowManualInput] = useState(false);
  const [range, setRange] = useState('5y');
  const historyFrom = rangeStart(range);
  const [weights, setWeights] = useState(DEFAULT_POINTS);

  // Restore saved slider positions once; storage can be blocked (private mode), so never fail on it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WEIGHTS_STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        setWeights(Object.fromEntries(Object.keys(DEFAULT_POINTS).map(k => [k, Number.isFinite(saved[k]) ? saved[k] : DEFAULT_POINTS[k]])));
      }
    } catch { /* ignore */ }
  }, []);
  const saveWeights = useCallback(next => {
    setWeights(next);
    try {
      if (isBacktestedWeights(next)) localStorage.removeItem(WEIGHTS_STORAGE_KEY);
      else localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);
  const isCustom = !isBacktestedWeights(weights);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    const keys = Object.keys(ROUTES);
    const results = await Promise.all(keys.map(k => fetchJson(ROUTES[k])));
    setAllData(Object.fromEntries(keys.map((k, i) => [k, results[i]])));
    setIsLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // "Revert to live" on a card. Throws so the card can show the error.
  const revertToLive = useCallback(async key => {
    const res = await fetch('/api/manual-data-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revert: [key] }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result.success) {
      throw new Error(res.status === 401
        ? 'Admin key required: use Manual data update'
        : result.error || `HTTP ${res.status}`);
    }
    await loadAll();
  }, [loadAll]);

  const cards = CARDS.map(c => ({ ...c, data: c.get(allData) }));
  const scores = Object.fromEntries(cards.map(c => [c.key, c.data && !c.data.error ? c.data.score : null]));
  const forecast = isLoading ? null : computeForecast(scores, weights);
  // With custom weights, keep the backtested verdict in view so the two are never confused.
  const baseline = !isLoading && isCustom ? computeForecast(scores) : null;
  const shareOf = k => forecast?.contributions?.[k]?.weight ?? WEIGHTS[k];
  const stale = cards.filter(c => c.data && !c.data.error && c.data.meta?.status === 'stale').map(c => c.key);
  const nextMeeting = allData.internationalRates?.nextMeeting;
  const market = allData.marketExpectations;
  // An old futures price says nothing about today's market: don't compare with it.
  const marketStale = market?.saronMeta?.status === 'stale';
  const comparison = forecast?.verdict && market && !market.error
    ? marketStale
      ? { message: 'Not compared: the SARON futures price is out of date. Enter a fresh one.', color: 'text-amber-800' }
      : (forecast.verdict.direction === market.direction
      ? { message: 'Model and market agree', color: 'text-green-700' }
      : { message: 'Model and market disagree', color: 'text-red-700' })
    : null;

  // Current values for the manual form, keyed by the form's field names.
  const current = {
    inflation: allData.inflation,
    snbRate: market && { value: market.currentSNBRate ?? null, meta: market.snbMeta },
    gdp: allData.economicHealth?.gdp,
    unemployment: allData.economicHealth?.unemployment,
    realEstate: allData.realEstate,
    exchangeRate: allData.exchangeRate,
    ecbRate: allData.internationalRates?.ecb,
    fedRate: allData.internationalRates?.fed,
    saronFutures: market && { value: market.futuresPrice ?? null, meta: market.saronMeta },
  };

  return (
    <main className="bg-gray-50 min-h-screen p-4 sm:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">SNB Monetary Policy Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Seven indicators, weighted into a HIKE / HOLD / CUT forecast for the next SNB meeting, compared with SARON futures.
          </p>
        </header>

        <CronBanner status={allData.status} />

        <div className="mb-6">
          <button
            onClick={() => setShowManualInput(v => !v)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 shadow"
          >
            {showManualInput ? '✕ Close manual update' : '📝 Manual data update'}
          </button>
          {showManualInput && (
            <div className="mt-4">
              <ManualDataInput
                current={current}
                nextMeeting={nextMeeting}
                authRequired={allData.status?.manualAuthRequired}
                onUpdate={loadAll}
              />
            </div>
          )}
        </div>

        {/* Model forecast */}
        <section className="mb-6">
          {isLoading ? (
            <div className="bg-gray-100 p-4 rounded-lg animate-pulse h-24 flex items-center justify-center text-gray-600">Loading data…</div>
          ) : !forecast.verdict ? (
            <div className="border-l-4 border-red-400 bg-red-50 p-4 rounded-r-lg shadow">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-900">Model forecast</h2>
              <p className="text-xl font-bold mt-1 text-red-900">Not enough data for a forecast</p>
              <p className="text-sm text-red-800 mt-1">
                Only {Math.round(forecast.coverage * 100)}% of the model weight is available. Missing: {forecast.missing.map(k => LABELS[k]).join(', ')}.
                {isCustom && ' (With your custom weights: try resetting them below.)'}
              </p>
            </div>
          ) : (
            <div className={`border-l-4 p-4 rounded-r-lg shadow ${VERDICT_STYLE[`${forecast.verdict.direction}-${forecast.verdict.strength}`]}`}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Model forecast {forecast.partial && <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-amber-200 text-amber-900 normal-case tracking-normal">Partial</span>}
                    {isCustom && <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white normal-case tracking-normal">Custom weights</span>}
                  </h2>
                  <p className="text-2xl font-bold mt-1">{forecast.verdict.text}</p>
                  <p className="text-sm font-semibold mt-1">Global weighted score: {forecast.score.toFixed(2)}</p>
                  {baseline && (
                    <p className="text-sm mt-1">
                      Backtested weights: <strong>{baseline.verdict ? `${baseline.verdict.text} (${baseline.score.toFixed(2)})` : 'not enough data'}</strong>
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <h3 className="text-sm font-bold">NEXT SNB MEETING</h3>
                  <p className="text-lg font-semibold">{nextMeeting?.date ? formatDate(nextMeeting.date) : 'Not set'}</p>
                  {nextMeeting && nextMeeting.status !== 'manual' && (
                    <span className="inline-flex items-center gap-1 text-xs mt-1">
                      <FreshnessBadge meta={{ reason: nextMeeting.reason }} status={nextMeeting.status} /> {nextMeeting.reason}
                    </span>
                  )}
                </div>
              </div>
              {(forecast.partial || stale.length > 0) && (
                <div className="mt-3 pt-3 border-t border-black/10 text-sm space-y-1">
                  {forecast.partial && (
                    <p>
                      <strong>Partial:</strong> missing {forecast.missing.map(k => `${LABELS[k]} (${Math.round(shareOf(k) * 100)}%)`).join(', ')}.
                      The other weights were scaled up to cover {Math.round(forecast.coverage * 100)}% of the model. Less reliable than the full model.
                    </p>
                  )}
                  {stale.length > 0 && (
                    <p><strong>Uses stale data:</strong> {stale.map(k => LABELS[k]).join(', ')}. Check those cards.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {!isLoading && (
          <WeightPanel
            weights={weights}
            onChange={(k, v) => saveWeights({ ...weights, [k]: v })}
            onReset={() => saveWeights(DEFAULT_POINTS)}
            forecast={forecast}
            isCustom={isCustom}
          />
        )}

        {/* Market view */}
        {market && (
          <section className="mb-8">
            {market.error ? (
              <div className="bg-blue-50 border-l-4 border-blue-300 p-4 rounded-r-lg shadow text-sm text-blue-900">
                <strong>Market expectations unavailable:</strong> {market.error}
              </div>
            ) : (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                      Market expectations (SARON futures) <FreshnessBadge meta={market.saronMeta} />
                    </h2>
                    <p className={`text-xl font-bold mt-1 text-blue-800 ${marketStale ? 'opacity-50' : ''}`}>{market.expectationText}</p>
                    {marketStale && (
                      <p className="text-sm text-amber-800 mt-1">
                        Based on a futures price from {market.saronMeta.observedAt ? formatDate(market.saronMeta.observedAt) : 'an unknown date'}. Ignore until updated.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 mt-3 text-sm text-blue-800">
                      <p><span className="font-semibold">Probability:</span> {market.probability}%</p>
                      <p><span className="font-semibold">Signal:</span> {market.signalStrength}</p>
                      <p><span className="font-semibold">Expected:</span> {market.expectedChangeBp}bp</p>
                      <p><span className="font-semibold">Move size:</span> {market.moveSize}</p>
                    </div>
                  </div>
                  <div className="sm:text-right text-blue-800">
                    <h3 className="text-sm font-bold text-blue-900">FUTURES DATA</h3>
                    <p className="text-lg font-semibold">{market.futuresPrice}</p>
                    <p className="text-xs">Implied: {market.impliedRate}%</p>
                    <p className="text-xs flex sm:justify-end items-center gap-1">
                      SNB rate: {market.currentSNBRate}% <FreshnessBadge meta={market.snbMeta} />
                    </p>
                    {market.snbMeta?.origin === 'manual' && (
                      <div className="text-xs"><RevertButton onRevert={() => revertToLive('snb_rate')} /></div>
                    )}
                    {market.saronMeta?.observedAt && <p className="text-xs">Price date: {formatDate(market.saronMeta.observedAt)}</p>}
                  </div>
                </div>
                {comparison && (
                  <div className="mt-4 pt-3 border-t border-blue-200 flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-900">Model vs market:</span>
                    <span className={`font-bold ${comparison.color}`}>{comparison.message}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Indicator cards; titles are built from WEIGHTS so they can't drift. */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold">Indicators</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">History:</span>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden" role="group" aria-label="History range">
              {RANGES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                  className={`px-3 py-1 border-l first:border-l-0 border-gray-300 ${range === r.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* The rate the forecast is about: context only, not one of the 7 scored indicators. */}
          {isLoading ? (
            <div className="col-span-full bg-white rounded-lg shadow p-5 h-72 animate-pulse" />
          ) : (
            <IndicatorCard
              title="SNB policy rate"
              data={market ? { value: market.currentSNBRate ?? null, meta: market.snbMeta, ...(market.currentSNBRate == null && { error: 'No SNB policy rate stored yet' }) } : null}
              format={pct}
              subtitle="Context: the rate the forecast is about (not scored). History starts June 2019, when the SNB introduced it."
              onRevert={revertToLive}
              historyKey="snb_rate"
              historyFrom={historyFrom}
              stepped
              wide
            />
          )}
          {cards.map((c, i) => isLoading ? (
            <div key={c.key} className="bg-white rounded-lg shadow p-5 h-72 animate-pulse" />
          ) : (
            <IndicatorCard
              key={c.key}
              title={`${i + 1}. ${LABELS[c.key]}`}
              weight={shareOf(c.key)}
              data={c.data}
              format={c.format}
              subtitle={c.subtitle?.(c.data)}
              onRevert={revertToLive}
              historyKey={c.history}
              stepped={c.stepped}
              historyFrom={historyFrom}
            />
          ))}
        </div>

        <footer className="text-center mt-12 text-sm text-gray-500">
          <p>For informational purposes only. Badges: Live = fetched automatically and recent · Manual = typed in · Stale = older than expected for that series. Orange dots on a chart = manual entries.</p>
        </footer>
      </div>
    </main>
  );
}
