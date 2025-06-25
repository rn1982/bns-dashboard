// File: /app/api/cron/inflation/route.js --- DEBUG VERSION ---

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('--- Starting Inflation Cron Job ---');

  // --- DEBUGGING STEP 1: Check if the Environment Variable is being read ---
  const apiKey = process.env.FRED_API_KEY;
  console.log('Is FRED_API_KEY present?', !!apiKey); // This will print true or false
  console.log('API Key length:', apiKey?.length || 0); // This will print the length of the key

  // If the key is missing, stop immediately.
  if (!apiKey) {
    const errorMsg = 'CRITICAL ERROR: FRED_API_KEY environment variable not found.';
    console.error(errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  const seriesId = 'CPGRLE01CHM659N'; 
  const fredURL = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;

  // --- DEBUGGING STEP 2: Log the exact URL we are trying to fetch ---
  // WARNING: This will print your secret API key in the terminal log. 
  // We will remove this line after we are done debugging.
  console.log('Fetching URL:', fredURL);

  try {
    const fredResponse = await fetch(fredURL);
    const fredData = await fredResponse.json();

    // --- DEBUGGING STEP 3: Log the raw response from FRED ---
    console.log('Raw response from FRED:', JSON.stringify(fredData, null, 2));

    if (!fredData.observations || fredData.observations.length === 0) {
      throw new Error('No observations found in FRED response');
    }

    const latestObservation = fredData.observations[0];
    const inflationValue = parseFloat(latestObservation.value);
    console.log(`Successfully fetched inflation value: ${inflationValue}`);

    await sql`
      UPDATE latest_indicators
      SET inflation_value = ${inflationValue}, inflation_updated_at = NOW()
      WHERE id = 1;
    `;
    console.log('Database update successful.');

    return NextResponse.json({ message: 'Inflation data updated successfully', value: inflationValue });

  } catch (error) {
    console.error('Error in inflation cron job:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}