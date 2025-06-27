// File: app/api/cron/update-fred/route.js
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function fetchFredSeries(seriesId, apiKey) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.observations || data.observations.length === 0) throw new Error(`No FRED data for ${seriesId}`);
  return parseFloat(data.observations[0].value);
}

export async function GET() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'FRED_API_KEY not found.' }, { status: 500 });
  try {
    const ecbRate = await fetchFredSeries('ECBDFR', apiKey);
    const fedRate = await fetchFredSeries('DFEDTARU', apiKey);
    await sql`
      UPDATE latest_indicators
      SET 
        ecb_rate_value = ${ecbRate}, ecb_updated_at = NOW(),
        fed_rate_value = ${fedRate}, fed_updated_at = NOW()
      WHERE id = 1;
    `;
    return NextResponse.json({ message: 'FRED data (ECB & Fed) updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: `FRED Cron Error: ${error.message}` }, { status: 500 });
  }
}