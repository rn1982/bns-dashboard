import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get live exchange rate data from database (populated by cron job)
    const { rows } = await sql`SELECT exchange_rate_value, exchange_rate_updated_at FROM latest_indicators WHERE id = 1;`;
    if (rows.length === 0) throw new Error("No exchange rate data found in database.");
    
    const rate = rows[0].exchange_rate_value;
    const updatedAt = rows[0].exchange_rate_updated_at;
    
    // UPDATED SCORING LOGIC for EUR/CHF Exchange Rate
    // Note: This logic is REVERSED from typical thinking
    // Strong CHF (low EUR/CHF) = hike pressure (deflationary concerns)
    // Weak CHF (high EUR/CHF) = cut pressure (inflationary concerns)
    let score = 0;
    if (rate < 0.93) score = 2;      // Below 0.93 (very strong CHF) - deflation risk, hike pressure
    else if (rate < 0.95) score = 1; // 0.93 to 0.95 - moderately strong CHF
    else if (rate <= 0.98) score = 0; // 0.95 to 0.98 - neutral range
    else if (rate <= 1.00) score = -1; // 0.98 to 1.00 - CHF weakening
    else score = -2;                 // Above 1.00 (weak CHF) - inflation risk, cut pressure

    const responseData = { 
      value: rate ? parseFloat(rate.toFixed(4)) : null,
      score: score, 
      source: "Alpha Vantage (Live)", 
      nextPublication: "Real-time",
      updatedAt: updatedAt,
      description: "EUR/CHF exchange rate - higher values indicate weaker CHF"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}