// File: /api/exchange-rate/route.js -- FINAL DATABASE VERSION
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT exchange_rate_value FROM latest_indicators WHERE id = 1;`;
    const rate = rows[0].exchange_rate_value;

    let score = 0;
    if (rate > 1.05) {
      score = 2;
    } else if (rate > 1.00) {
      score = 1;
    } else if (rate >= 0.96) {
      score = 0;
    } else if (rate >= 0.92) {
      score = -1;
    } else {
      score = -2;
    }

    // We are no longer providing historicalData from this API
    const responseData = { 
      value: rate, 
      score: score, 
      source: "ECB (DB)", 
      nextPublication: "Daily" 
    };
    return NextResponse.json(responseData);

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}