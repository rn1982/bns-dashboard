# Handover: SNB dashboard v2

Read `CLAUDE.md` first for how the current code works. This file covers **what to do next and why**.

## Objective

Make the dashboard (1) reliable, so the data shown is always correct and its freshness is visible; (2) easy to correct by hand when a live source fails; (3) modern and interactive.

**Stack decision (made):** keep Next.js and React and evolve the existing app. No three.js, no rewrite to plain HTML.

**Working style:** the owner is new to coding. Work one step at a time, explain each change briefly, and verify each step before moving on.

## Confirmed in production (2026-11-13)

Calling `https://bns-dashboard-delta.vercel.app/api/cron/update-all` returns:

```json
{"message":"All data sources updated via master cron job","results":{
  "swissData":{"error":"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"},
  "fredData":{"error":"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"},
  "exchangeData":{"error":"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"}}}
```

All three sub-jobs get an HTML page back instead of JSON. Despite the "updated" message, **no live data has been written**. This confirms diagnosis 1. Fix it first in Step 1.

## Diagnosis: why the live data is broken

Found by reading the code; not yet verified against production.

1. **The daily cron fails silently (CONFIRMED).** `app/api/cron/update-all/route.js` calls the other cron routes over HTTP at `https://${VERCEL_URL}`. That is the deployment-specific URL, and Deployment Protection usually blocks it. The errors are only logged, so the database row is never updated.
2. **The ECB/Fed stance is always neutral.** `ECBDFR` and `DFEDTARU` are daily series, but `determineCentralBankStance` in `app/lib/fred.js` takes the last 12 observations and compares index 0 with index 3. That is roughly 3 days apart, not 3 months, so the change is about 0 and the stance is `hold_neutral`. ECB plus Fed make up 20% of the model's weight.
3. **"Live" is a label, not a fact.** Every reader route only reads the single DB row, and `"FRED (Live)"` is hard-coded. Stale data looks the same as fresh data.
4. **The SNB rate source is questionable.** FRED `INTDSRCHM193N` is an old IMF monthly series and is probably stale. The SNB policy rate should come from the SNB data portal, or be manual.
5. **`@vercel/postgres` is deprecated.** Vercel Postgres has moved to Neon.

Also worth cleaning up: `data/manual_indicators.json` is unused and out of date; `update-swiss-data/route.js.backup` is dead; the fetch-everything block is duplicated in `app/page.js`.

## Plan: four steps, in order

### Step 1: Fix the data layer (reliability first) — CODE DONE 2026-11-13, awaiting production check
Done: direct fetchers in `app/lib/sources/`, FSO Excel for CPI (SNB backup), SNB portal for policy rate, real GDP and unemployment, ECB for EUR/CHF and deposit rate, 90-day stance logic with tests, GDP converted from level to YoY %, `CRON_SECRET`, provenance columns + manual-vs-live rule, dead cron routes removed, `?dryRun=1`.
Bugs found on the way: EUR/CHF was stored inverted (1.08 instead of 0.92, scoring +2 instead of −2); GDP would have been stored as a level (~180,000) instead of a growth %; the manual form posted to a `/api/cron/` route.
Verified in a preview deployment: SNB rate, CPI, EUR/CHF, ECB, Fed. FRED's old Swiss GDP series was deleted, so GDP moved to SNB `gdprpq` (real). CPI moved to FSO because SNB lagged a month (showed Sep 0.99% while FSO had Oct 1.5%).
Still open: manual endpoint has no auth; no live source yet for real estate, SARON futures.

Original plan:
- Replace the HTTP self-calls in `update-all` with direct imports of shared fetcher functions, e.g. `app/lib/sources/*.js`. Each fetcher returns `{ value, date, source }` or throws.
- Fix the stance logic: fetch about 120 days of observations (`observation_start`), then compare the latest value with the value on or before today minus 90 days.
- Replace the SNB rate source (SNB data portal), or make it manual-only. Check every source the cron routes use: World Bank CPI, Alpha Vantage EUR/CHF, FRED GDP.
- Protect the cron routes with `CRON_SECRET` (`Authorization: Bearer` header, which Vercel cron sends).
- For every indicator, store: value, observation date, fetched-at time, and **origin** (`live` | `manual`) plus the source name.
- **Done when:** running the cron updates every live field; the stance changes when the rate history changes; the cron's JSON lists any failures.

### Step 2: Make correctness visible, and keep manual override first-class — CODE DONE 2026-11-13, awaiting preview check
Done: `maxAgeDays` per indicator in `app/lib/indicators.js`; `app/lib/freshness.js` (Live / Manual / Stale / Missing, age measured from the observation date); every reader route returns `meta` (real source, observation date, badge) through `readRow` / `readIndicator` in `app/lib/db.js`; `app/lib/model.js` holds WEIGHTS, thresholds and `computeForecast` (partial verdict: missing indicators are dropped and the other weights scaled up; no verdict under 50% coverage); `/api/status` returns the last cron run for the banner; the manual form shows current values with badges and adds ECB/Fed rate + stance, next meeting, observation date and "revert to live" (`revert: [key]` runs the live fetcher with `force`); optional `MANUAL_UPDATE_SECRET` protects the manual endpoint (header `x-admin-key`). Tests: `app/lib/model.test.mjs`.
Removed fake data: default ECB 2.0% / Fed 4.5% / `hold_neutral` stance, hard-coded CPI history, null values scored as 0.
To check on the preview: badges look right with real DB data; a manual save, then "revert to live"; set `MANUAL_UPDATE_SECRET` in Vercel.

Original plan:
- On each card, show the source, the observation date and a badge: **Live** / **Manual** / **Stale** (older than an expected age set per indicator, e.g. CPI 45 days, FX 3 days).
- Rule: a manual value is kept until a newer live observation arrives, or until the user clears it. The cron must never silently overwrite a newer manual entry.
- Keep `ManualDataInput` and add the missing fields (ECB/Fed stance, next meeting date). Validate ranges on the server.
- Show the verdict even if one indicator fails: mark it as partial and list the missing indicators. Today a single error hides the whole verdict.
- **Done when:** a user can see at a glance which numbers are trustworthy, and can fix any of them by hand.

### Step 3: Add history — DONE and verified on the preview 2026-11-13
Done: `indicator_history` table (`app/lib/history.js`, created by `ensureSchema`); every source is now a series fetcher (`from` → all points), so the daily cron writes the current value AND upserts its recent window into history (revisions are picked up, re-runs write nothing); manual saves add a `manual` point, "revert to live" deletes it; `/api/cron/backfill` (one-off, `CRON_SECRET`) loads everything since 2000; `/api/history?indicator=…` serves the series (manual wins on the same date; `freq=monthly` for long daily series). Tests: `app/lib/sources/snb.test.mjs`; SQL checked against a local Postgres 16 (not in `npm test`).
Deviation from the plan: `latest_indicators` was NOT turned into a view over the history. It keeps the manual-vs-live rule, stances and the cron report; changing it brings risk and no visible gain. Revisit only if the two ever disagree.
Backfill sources: the live sources themselves (SNB, FSO, ECB, FRED), not only FRED.
Verified on the preview (Neon driver included): backfill wrote 25,914 points (all 7 live indicators, Fed from 2008-12, SNB rate from 2019-06); a re-run wrote 0; `/api/history?indicator=inflation` returns the FSO series up to Oct 2026 (1.5%).
Found while checking: `/api/cron/*` answered without an `Authorization` header, so `CRON_SECRET` is not set for the Preview environment (check Production too).
Gaps: SNB policy rate history starts 2019-06 (3M Libor target before that: not loaded); no stance history (can be recomputed from the rate series in Step 4); real estate / SARON only from manual entries.

Original plan:
- Add an `indicator_history` table (indicator, value, observed_at, origin, source). The cron and manual updates append rows to it; `latest_indicators` becomes "the latest row per indicator".
- Backfill from FRED where series exist.
- Add a `/api/history?indicator=...` route.
- **Done when:** each indicator has a time series the UI can chart.

### Step 4: Modern, interactive UI — IN PROGRESS
Done 2026-11-13: history chart on each indicator card (`app/components/HistoryChart.js`, reads `/api/history`; manual points in orange) with a 1Y / 5Y / 10Y / Since 2000 range selector above the cards; readable stance labels; unused `MiniChart.js` removed.
Next, in order: weight sliders with live verdict + reset; SNB rate / market history; replay of past meetings (needs per-indicator scoring moved into `app/lib/model.js` first); visual refresh and dark mode.

- `app/lib/model.js` exists (weights, thresholds, verdict, tests) since Step 2. Still to move there: the per-indicator scoring that lives in each reader route.
- Add weight sliders that recompute the verdict live (with "reset to backtested weights"), history charts on each card, model-vs-market over time, and a selector to replay past SNB meeting dates.
- Update the visual design (clean layout, dark mode, works on mobile). Keep the information density.
- Optional: migrate `@vercel/postgres` to `@neondatabase/serverless`.
- **Done when:** the owner can play with the weights and see how the forecast and its history change.

## Environment notes
- Production: `https://bns-dashboard-delta.vercel.app/` (Vercel; daily cron at 08:00 UTC, see `vercel.json`).
- Environment variables: `POSTGRES_URL`, `FRED_API_KEY`, `ALPHA_VANTAGE_API_KEY`, plus `CRON_SECRET` from step 1.
- The cloud sessions here have no production keys or DB access. Verifying against production needs either the owner pasting outputs, or keys added through the environment's credentials.
- Development branches: `claude/confident-wright-rlj4rp` (Step 2), `claude/elegant-hypatia-hyiodu` (Step 3).
- Optional env var `MANUAL_UPDATE_SECRET`: when set, the manual form needs that admin key.
