// File: app/api/cron/remaining-indicators/route.js --- MOCK DATA VERSION ---
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Using a reliable set of mock data
    const dataToUpdate = {
      gdp_value: 1.9,
      unemployment_value: 2.3,
      ecb_rate_value: 4.25,
      fed_rate_value: 5.50,
    };
    console.log('Using mock data for remaining indicators:', dataToUpdate);

    await sql`
      UPDATE latest_indicators
      SET 
        gdp_value = ${dataToUpdate.gdp_value}, gdp_updated_at = NOW(),
        unemployment_value = ${dataToUpdate.unemployment_value}, unemployment_updated_at = NOW(),
        ecb_rate_value = ${dataToUpdate.ecb_rate_value}, ecb_updated_at = NOW(),
        fed_rate_value = ${dataToUpdate.fed_rate_value}, fed_updated_at = NOW()
      WHERE id = 1;
    `;
    console.log('Database updated successfully with remaining mock indicators.');
    return NextResponse.json({ message: 'Remaining indicator mock data updated successfully', data: dataToUpdate });
  } catch (error) {
    console.error('Error in remaining indicators cron job:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}