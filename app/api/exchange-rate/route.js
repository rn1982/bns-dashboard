import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT exchange_rate_value, exchange_rate_updated_at FROM latest_indicators WHERE id = 1;`;
    if (rows.length === 0) throw new Error("No exchange rate data found in database.");
    
    const rate = rows[0].exchange_rate_value;
    const updatedAt = rows[0].exchange_rate_updated_at;
    
    // Scoring logic for EUR/CHF exchange rate
    let score = 0;
    if (rate > 0.97) score = 2;      // Strong EUR (inflationary pressure)
    else if (rate > 0.95) score = 1; // Moderate EUR strength
    else if (rate >= 0.92) score = 0; // Neutral range
    else if (rate >= 0.90) score = -1; // CHF strengthening
    else score = -2;                  // Strong CHF (deflationary risk)

    const responseData = { 
      value: rate ? parseFloat(rate.toFixed(4)) : null,
      score: score, 
      source: "Alpha Vantage (Live)", 
      nextPublication: "Real-time",
      updatedAt: updatedAt
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}