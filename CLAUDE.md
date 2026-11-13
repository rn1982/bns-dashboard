# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SNB (Swiss National Bank) monetary-policy dashboard: a Next.js 15 App Router app (plain JavaScript, React 19, Tailwind v4, Chart.js) deployed on Vercel. It scores 7 macro indicators, combines them into a weighted score and turns that into a HIKE / HOLD / CUT forecast for the next SNB meeting. It then compares the forecast with the market view implied by SARON futures. Code comments and some UI strings are a mix of English and French.

## Commands

```bash
npm run dev     # local dev server on http://localhost:3000
npm run build   # production build
npm run lint    # next lint (ESLint 9, eslint-config-next)
npm test        # node --test on app/**/*.test.mjs (stance, freshness, model, SNB quarter maths)
```

Dry-run the data fetchers without touching the DB: `GET /api/cron/update-all?dryRun=1` (or `/api/cron/backfill?dryRun=1` for the full history). In the cloud sandbox, start the dev server with `NODE_USE_ENV_PROXY=1` or Node's fetch can't reach the internet.

## Environment

- `POSTGRES_URL` (and the related vars read by `@vercel/postgres`): every API route reads and writes the database.
- `FRED_API_KEY`: the FRED fetch in `app/lib/sources/fred.js` (Fed rate only).
- `CRON_SECRET`: if set, `/api/cron/*` requires `Authorization: Bearer <CRON_SECRET>` (Vercel cron sends it automatically).
- `MANUAL_UPDATE_SECRET`: if set, `POST /api/manual-data-update` requires header `x-admin-key: <secret>` (the form asks for it; `/api/status` says whether it is required).
- `ALPHA_VANTAGE_API_KEY`: no longer used (EUR/CHF now comes from the ECB).

## Architecture

**Data flow is two-stage, and the database sits in the middle:**

1. **Writer: cron.** `vercel.json` schedules `/api/cron/update-all` (daily 08:00 UTC). It runs the jobs listed in `JOBS` (`app/lib/jobs.js`, which imports `app/lib/sources/`) directly (no HTTP self-calls). Each source function returns a **series** `{ points: [{ date, value }], source }` from a `from` date; `runJob` fetches the last `windowDays`, writes the last point via `writeLive` in `app/lib/db.js` and upserts the whole window into `indicator_history` (catches revisions). ECB/Fed stances are computed in `runJob` from the same series. Live sources:
   - CPI YoY: FSO Excel `cc-d-05.02.08` (found through the FSO DAM API, column `% m-12`), with SNB `plkopr/VVP` as backup; the newer month wins. SNB lags FSO by ~3 weeks.
   - SNB data portal: policy rate `snbgwdzid/LZ`, real GDP `gdprpq/WMF,BBIPS` (turned into YoY %; `gdpap` is NOMINAL, don't use it), jobless rate SA `amarbma/S1`.
   - ECB data API: EUR/CHF reference rate (CHF per EUR, do not invert), deposit facility rate + stance.
   - FRED: Fed upper target `DFEDTARU` + stance.
   Real estate, SARON futures and next meeting date have no live source: manual only.
   `/api/cron/backfill[?from=2000-01-01][&indicator=…][&dryRun=1]` (same `CRON_SECRET` auth, not scheduled) runs the same series fetchers from 2000 and fills `indicator_history` only; safe to re-run.
   `read-excel-file` is listed in `serverExternalPackages` in `next.config.mjs` (its unzip dependency can't be bundled). The route returns a per-indicator report (`updated` / `kept_manual` / `failed`), HTTP 500 if anything failed, and stores it in `last_cron_report`.
2. **Manual writer:** `POST /api/manual-data-update` (used by `app/components/ManualDataInput.js`) validates ranges from `app/lib/indicators.js` and writes via `writeManual` (which also adds an `origin = 'manual'` point to `indicator_history`, except for stance-only edits). Fields: the 7 numbers, `ecbRate`/`fedRate` + `ecbStance`/`fedStance`, `saronFutures`, `nextMeeting`, optional `observedAt` (YYYY-MM-DD, default today), and `revert: [key]`, which runs that indicator's live job with `force` to drop a manual value and deletes the manual history point.
   **Manual vs live rule:** each indicator has `<prefix>_observed_at`, `<prefix>_origin` (`live`|`manual`) and `<prefix>_source` columns (added on the fly by `ensureSchema`). The cron overwrites a manual value only when its observation date is later than the manual one.
3. **Readers: indicator routes** (`/api/inflation`, `/api/real-estate`, `/api/exchange-rate`, `/api/economic-health`, `/api/international-rates`, `/api/market-expectations`) read the row with `readRow()` and turn raw values into a `score` in [-2, +2]. Each indicator comes with `meta` from `readIndicator()`: stored source, observation date, origin and a freshness `status` (`live` | `manual` | `stale` | `missing`, see `app/lib/freshness.js`; stale = observation older than `maxAgeDays` in `app/lib/indicators.js`). A null value returns `{ error, meta }` instead of a score. They never call external APIs. `/api/status` returns the last cron run and its failures. `/api/history?indicator=<key>[&from][&to][&freq=raw|monthly]` returns the time series for charts (monthly = last observation per month, the default for ranges over 2 years).

The **current** values live in the one-row table `latest_indicators` (id = 1). The **time series** live in `indicator_history` (`app/lib/history.js`; PK `(indicator, observed_at, origin)`, created by `ensureSchema`). When a date has both a manual and a live point, `readHistory` shows the manual one (same rule as `writeLive`). History starts: SNB policy rate 2019-06 (introduced then), Fed range 2008-12, the rest 2000; real estate and SARON futures only from manual entries. No schema or migration file is in the repo. Column names per indicator are listed in `app/lib/indicators.js`; `ensureSchema()` adds missing provenance columns with `ADD COLUMN IF NOT EXISTS`. `app/api/debug/database/route.js` dumps the table.

**Stance (`app/lib/stance.js`):** `stanceFromSeries` compares the latest rate with the rate on or before latest date − 90 days and returns one of seven stance strings (`hike_aggressive` … `cut_aggressive`, listed in `app/lib/indicators.js`). `/api/international-rates` maps each stance to a score. If you change the vocabulary, update both places.

**Verdict:** `app/lib/model.js` holds `WEIGHTS` (inflation 0.30, real estate 0.20, EUR/CHF 0.15, ECB 0.15, GDP 0.10, unemployment 0.05, Fed 0.05), thresholds ±0.35 / ±1.0 (from 2000–2025 backtesting; the backtest code is not in the repo) and `computeForecast(scores, weights = WEIGHTS)` (weights are normalised; it also returns per-indicator `contributions`). `app/components/WeightPanel.js` lets the viewer change the weights with sliders (kept in their browser's localStorage only); the page then shows a "Custom weights" badge plus the backtested verdict. `app/page.js` (a `'use client'` component) fetches the reader routes, passes the per-indicator scores in, and shows a *partial* verdict when some are missing (their weight is dropped and the rest scaled up; no verdict below 50% coverage). Card titles are generated from `WEIGHTS`.

**Market view:** `/api/market-expectations` compares the stored SNB rate with the SARON futures implied rate, and turns the gap (in bp) into direction, probability and move size through a hand-built lookup table.
