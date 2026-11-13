# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SNB (Swiss National Bank) monetary-policy dashboard: a Next.js 15 App Router app (plain JavaScript, React 19, Tailwind v4, Chart.js) deployed on Vercel. It scores 7 macro indicators, combines them into a weighted score and turns that into a HIKE / HOLD / CUT forecast for the next SNB meeting. It then compares the forecast with the market view implied by SARON futures. Code comments and some UI strings are a mix of English and French.

## Commands

```bash
npm run dev     # local dev server on http://localhost:3000
npm run build   # production build
npm run lint    # next lint (ESLint 9, eslint-config-next)
```

There is no test suite.

## Environment

- `POSTGRES_URL` (and the related vars read by `@vercel/postgres`): every API route reads and writes the database.
- `FRED_API_KEY`: the FRED fetches in `app/lib/fred.js`.
- `ALPHA_VANTAGE_API_KEY`: EUR/CHF (`app/api/cron/update-exchange-rate/route.js`).

## Architecture

**Data flow is two-stage, and the database sits in the middle:**

1. **Writers: cron routes** (`app/api/cron/*`) fetch external sources and `UPDATE latest_indicators ... WHERE id = 1`. `vercel.json` schedules only `/api/cron/update-all` (daily 08:00 UTC). That route calls `update-swiss-data`, `update-fred` and `update-exchange-rate` over HTTP using `https://${VERCEL_URL}`. The other cron routes (`update-swiss-cpi`, `update-swiss-realtime`, `manual-backup`, `manual-data-update`) are not scheduled and only run when called by hand.
2. **Manual writer:** `POST /api/manual-data-update` (used by `app/components/ManualDataInput.js`) writes inflation, SNB rate, SARON futures price (validated 95–105; it stores `market_implied_rate = 100 - price`), GDP, unemployment, real estate and EUR/CHF. The automatic crons deliberately do **not** overwrite inflation, unemployment or real estate, so that manual values persist.
3. **Readers: indicator routes** (`/api/inflation`, `/api/real-estate`, `/api/exchange-rate`, `/api/economic-health`, `/api/international-rates`, `/api/market-expectations`) only `SELECT` from `latest_indicators` and turn raw values into a `score` in [-2, +2] plus display fields. They never call external APIs, so "live" data is only as fresh as the last cron run, even though the labels say "FRED (Live)".

The single source of truth is the one-row table `latest_indicators` (id = 1). No schema or migration file is in the repo. Infer the column names from the SQL in the routes (`*_value`, `*_updated_at`, `ecb_stance`, `fed_stance`, `next_meeting_date`, `saron_futures_price`, `market_implied_rate`, …). `app/api/debug/database/route.js` dumps the table. `data/manual_indicators.json` is a static, out-of-date snapshot that no code reads.

**FRED (`app/lib/fred.js`):** `FRED_SERIES` holds the series IDs (ECB deposit rate `ECBDFR`, Fed upper target `DFEDTARU`, Swiss real GDP, SNB rate). `determineCentralBankStance` turns the change in recent observations into one of seven stance strings (`hike_aggressive` … `cut_aggressive`). `/api/international-rates` then maps each stance to a score. If you change the stance vocabulary, update both places.

**Scoring and verdict live in the client:** `app/page.js` (a `'use client'` component) fetches all 6 reader routes in parallel and applies `WEIGHTS` (inflation 0.30, real estate 0.20, EUR/CHF 0.15, ECB 0.15, GDP 0.10, unemployment 0.05, Fed 0.05). It maps the global score to a verdict with thresholds ±0.35 and ±1.0, which came from 2000–2025 backtesting (the backtest code is not in the repo). The card titles in `page.js` repeat the weights as text, so keep them in sync. If any reader route returns `error`, no verdict is shown.

**Market view:** `/api/market-expectations` compares the stored SNB rate with the SARON futures implied rate, and turns the gap (in bp) into direction, probability and move size through a hand-built lookup table.
