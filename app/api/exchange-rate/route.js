import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get live exchange rate data from database (populated by cron job)
    const { rows } = await sql`SELECT exchange_rate_value, exchange_rate_updated_at FROM latest_indicators WHERE id = 1;`;
    if (rows.length === 0) throw new Error("No exchange rate data found in database.");
    
    const rate = rows[0].exchange_rate_value;
    const updatedAt = rows[0].exchange_rate_updated_at;
    
    // CORRECTED SNB LOGIC - Based on Historical Evidence (2011-2015 & 2024-2025)
    // CHF fort (low EUR/CHF) = CUT pressure (competitiveness concerns)
    // CHF faible (high EUR/CHF) = HIKE pressure (inflation risk from imports)
    let score = 0;
    if (rate > 1.00) score = 2;       // Above 1.00 (CHF weak) - inflation risk, HIKE pressure
    else if (rate > 0.98) score = 1;  // 0.98 to 1.00 - moderate HIKE pressure
    else if (rate >= 0.95) score = 0; // 0.95 to 0.98 - neutral range (SNB comfort zone)
    else if (rate >= 0.93) score = -1; // 0.93 to 0.95 - moderate CUT pressure
    else score = -2;                  // Below 0.93 (CHF very strong) - strong CUT pressure
    
    // Interpretation based on SNB historical behavior
    let interpretation = "";
    let historicalContext = "";
    
    if (score <= -1) {
      interpretation = `CHF too strong at ${rate} - Exporters under pressure, SNB likely to CUT rates`;
      historicalContext = "Like 2011-2015: SNB introduced 1.20 floor + negative rates to weaken CHF";
    } else if (score >= 1) {
      interpretation = `CHF weakening at ${rate} - Imported inflation risk, SNB can HIKE rates`;
      historicalContext = "SNB can afford to tighten when CHF is not overvalued";
    } else {
      interpretation = `EUR/CHF at ${rate} - SNB comfort zone, neutral policy stance`;
      historicalContext = "CHF at acceptable level for Swiss exporters";
    }
    
    const responseData = { 
      value: rate ? parseFloat(rate.toFixed(4)) : null,
      score: score, 
      source: "Alpha Vantage (Live)", 
      nextPublication: "Real-time",
      updatedAt: updatedAt,
      description: "EUR/CHF exchange rate - SNB prioritizes export competitiveness",
      interpretation: interpretation,
      historicalContext: historicalContext,
      snbLogic: "Strong CHF = Export pressure → Rate cuts (2011-2015 precedent)"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}