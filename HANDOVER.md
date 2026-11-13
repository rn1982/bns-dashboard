# Handover: SNB dashboard v2

Read `CLAUDE.md` first for how the current code works. This file covers **what to do next and why**.

## Objective

Make the dashboard (1) reliable, so the data shown is always correct and its freshness is visible; (2) easy to correct by hand when a live source fails; (3) modern and interactive.

**Stack decision (made):** keep Next.js and React and evolve the existing app. No three.js, no rewrite to plain HTML.

**Working style:** the owner is new to coding. Work one step at a time, explain each change briefly, and verify each step before moving on.

## Open input from the owner

The output of `https://bns-dashboard-delta.vercel.app/api/cron/update-all` (the `results` object) was meant to be shared but never arrived. Ask for it first, because it confirms or rules out diagnosis 1 below.

## Diagnosis: why the live data is broken

Found by reading the code; not yet verified against production.

1. **The daily cron probably fails silently.** `app/api/cron/update-all/route.js` calls the other cron routes over HTTP at `https://${VERCEL_URL}`. That is the deployment-specific URL, and Deployment Protection usually blocks it. The errors are only logged, so the database row is never updated.
2. **The ECB/Fed stance is always neutral.** `ECBDFR` and `DFEDTARU` are daily series, but `determineCentralBankStance` in `app/lib/fred.js` takes the last 12 observations and compares index 0 with index 3. That is roughly 3 days apart, not 3 months, so the change is about 0 and the stance is `hold_neutral`. ECB plus Fed make up 20% of the model's weight.
3. **"Live" is a label, not a fact.** Every reader route only reads the single DB row, and `"FRED (Live)"` is hard-coded. Stale data looks the same as fresh data.
4. **The SNB rate source is questionable.** FRED `INTDSRCHM193N` is an old IMF monthly series and is probably stale. The SNB policy rate should come from the SNB data portal, or be manual.
5. **`@vercel/postgres` is deprecated.** Vercel Postgres has moved to Neon.

Also worth cleaning up: `data/manual_indicators.json` is unused and out of date; `update-swiss-data/route.js.backup` is dead; the fetch-everything block is duplicated in `app/page.js`.

## Plan: four steps, in order

### Step 1: Fix the data layer (reliability first)
- Replace the HTTP self-calls in `update-all` with direct imports of shared fetcher functions, e.g. `app/lib/sources/*.js`. Each fetcher returns `{ value, date, source }` or throws.
- Fix the stance logic: fetch about 120 days of observations (`observation_start`), then compare the latest value with the value on or before today minus 90 days.
- Replace the SNB rate source (SNB data portal), or make it manual-only. Check every source the cron routes use: World Bank CPI, Alpha Vantage EUR/CHF, FRED GDP.
- Protect the cron routes with `CRON_SECRET` (`Authorization: Bearer` header, which Vercel cron sends).
- For every indicator, store: value, observation date, fetched-at time, and **origin** (`live` | `manual`) plus the source name.
- **Done when:** running the cron updates every live field; the stance changes when the rate history changes; the cron's JSON lists any failures.

### Step 2: Make correctness visible, and keep manual override first-class
- On each card, show the source, the observation date and a badge: **Live** / **Manual** / **Stale** (older than an expected age set per indicator, e.g. CPI 45 days, FX 3 days).
- Rule: a manual value is kept until a newer live observation arrives, or until the user clears it. The cron must never silently overwrite a newer manual entry.
- Keep `ManualDataInput` and add the missing fields (ECB/Fed stance, next meeting date). Validate ranges on the server.
- Show the verdict even if one indicator fails: mark it as partial and list the missing indicators. Today a single error hides the whole verdict.
- **Done when:** a user can see at a glance which numbers are trustworthy, and can fix any of them by hand.

### Step 3: Add history (needed for charts and interactivity)
- Add an `indicator_history` table (indicator, value, observed_at, origin, source). The cron and manual updates append rows to it; `latest_indicators` becomes "the latest row per indicator".
- Backfill from FRED where series exist.
- Add a `/api/history?indicator=...` route.
- **Done when:** each indicator has a time series the UI can chart.

### Step 4: Modern, interactive UI
- Move the scoring (`WEIGHTS`, thresholds, per-indicator scoring) into one pure module, `app/lib/model.js`, used by both server and client. Add a small unit test for it, which is the first test in the repo.
- Add weight sliders that recompute the verdict live (with "reset to backtested weights"), history charts on each card, model-vs-market over time, and a selector to replay past SNB meeting dates.
- Update the visual design (clean layout, dark mode, works on mobile). Keep the information density.
- Optional: migrate `@vercel/postgres` to `@neondatabase/serverless`.
- **Done when:** the owner can play with the weights and see how the forecast and its history change.

## Environment notes
- Production: `https://bns-dashboard-delta.vercel.app/` (Vercel; daily cron at 08:00 UTC, see `vercel.json`).
- Environment variables: `POSTGRES_URL`, `FRED_API_KEY`, `ALPHA_VANTAGE_API_KEY`, plus `CRON_SECRET` from step 1.
- The cloud sessions here have no production keys or DB access. Verifying against production needs either the owner pasting outputs, or keys added through the environment's credentials.
- Development branch: `claude/ecstatic-dirac-fff2m0`.
