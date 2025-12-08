import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { fetchFredSeries, determineCentralBankStance, FRED_SERIES } from '../../../lib/fred';

export async function GET() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'FRED_API_KEY not found' }, { status: 500 });

  console.log('🚀 Starting Swis Data Update (FRED + Stances)...');
  const results = { successful: [], failed: [] };

  try {
    // 1. Fetch Swiss GDP from FRED
    try {
      const gdpData = await fetchFredSeries(FRED_SERIES.SWISS_GDP, apiKey);
      await sql`UPDATE latest_indicators SET gdp_value = ${gdpData.value}, gdp_updated_at = NOW() WHERE id = 1`;
      results.successful.push('Swiss GDP');
    } catch (e) {
      console.warn('Skipping Swiss GDP update:', e.message);
      results.failed.push('Swiss GDP');
    }

    // 2. Fetch SNB Rate from FRED
    try {
      const snbData = await fetchFredSeries(FRED_SERIES.SNB_RATE, apiKey);
      await sql`UPDATE latest_indicators SET snb_policy_rate_value = ${snbData.value}, snb_updated_at = NOW() WHERE id = 1`;
      results.successful.push('SNB Rate');
    } catch (e) {
      console.warn('Skipping SNB Rate update:', e.message);
      results.failed.push('SNB Rate');
    }

    // 3. Update Stances (ECB & Fed)
    // Note: These are also updated in swiss-realtime, but doing it here ensures consistency
    const ecbStance = await determineCentralBankStance(FRED_SERIES.ECB_RATE, apiKey);
    const fedStance = await determineCentralBankStance(FRED_SERIES.FED_RATE, apiKey);

    await sql`
      UPDATE latest_indicators 
      SET ecb_stance = ${ecbStance}, fed_stance = ${fedStance}, updated_at = NOW() 
      WHERE id = 1
    `;
    results.successful.push('Stances');

    // NOTE: Inflation, Unemployment, Real Estate are NOT updated here automatically anymore.
    // This allows the manual values entered by the user to persist.
    // Previously, this script was overwriting them with hardcoded static values.

    return NextResponse.json({
      message: 'Swiss data updated (FRED sources only)',
      results,
      note: 'Manual fields (Inflation, Real Estate, etc) were NOT touched.'
    });

  } catch (error) {
    console.error('❌ Critical Swiss Data Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}