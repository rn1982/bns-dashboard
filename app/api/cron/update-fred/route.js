// File: app/api/cron/update-fred/route.js
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { fetchFredSeries, FRED_SERIES } from '../../../lib/fred';

export async function GET() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'FRED_API_KEY not found.' }, { status: 500 });

  try {
    const ecbData = await fetchFredSeries(FRED_SERIES.ECB_RATE, apiKey);
    const fedData = await fetchFredSeries(FRED_SERIES.FED_RATE, apiKey);

    await sql`
      UPDATE latest_indicators
      SET 
        ecb_rate_value = ${ecbData.value}, ecb_updated_at = NOW(),
        fed_rate_value = ${fedData.value}, fed_updated_at = NOW()
      WHERE id = 1;
    `;

    return NextResponse.json({
      message: 'FRED data (ECB & Fed) updated successfully',
      data: { ecb: ecbData.value, fed: fedData.value }
    });
  } catch (error) {
    return NextResponse.json({ error: `FRED Cron Error: ${error.message}` }, { status: 500 });
  }
}