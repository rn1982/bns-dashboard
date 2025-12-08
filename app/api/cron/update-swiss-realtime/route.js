import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { determineCentralBankStance, FRED_SERIES } from '../../../lib/fred';

export async function GET() {
  try {
    console.log('🚀 Real-time Swiss data update (Stances & Market Probability)...');

    // 1. Get current SNB rate from DB for probability calculation
    // We do NOT overwrite verified data (Inflation, GDP, etc) with hardcoded values anymore.
    const { rows } = await sql`SELECT snb_policy_rate_value, saron_futures_price FROM latest_indicators WHERE id = 1 LIMIT 1;`;
    if (rows.length === 0) throw new Error("No database record found for id=1");

    const currentSnbRate = rows[0].snb_policy_rate_value || 0.0;
    const currentSaronFutures = rows[0].saron_futures_price || 99.75; // Fallback if missing

    // 2. Fetch Stances using centralized service
    const fredApiKey = process.env.FRED_API_KEY;

    const ecbStance = await determineCentralBankStance(FRED_SERIES.ECB_RATE, fredApiKey);
    const fedStance = await determineCentralBankStance(FRED_SERIES.FED_RATE, fredApiKey);

    // 3. Calculate Market Probability
    // Using current DB values for calculation
    const impliedRate = 100 - currentSaronFutures;
    const expectedChange = Math.abs(currentSnbRate - impliedRate);
    const probability = expectedChange >= 0.25 ? 75 :
      expectedChange >= 0.15 ? 60 : 50;

    // 4. Update Database
    // Only updating derived/external fields, LEAVING MANUAL FIELDS ALONE
    await sql`
      UPDATE latest_indicators
      SET 
        ecb_stance = ${ecbStance},
        fed_stance = ${fedStance},
        market_implied_rate = ${impliedRate},
        market_probability = ${probability},
        updated_at = NOW()
      WHERE id = 1;
    `;

    return NextResponse.json({
      success: true,
      message: '✅ Swiss Realtime data updated (Stances & Probabilities)',
      timestamp: new Date().toISOString(),
      data: {
        ecbStance,
        fedStance,
        marketProbability: probability,
        usedSnbRate: currentSnbRate,
        usedSaronPrice: currentSaronFutures
      }
    });

  } catch (error) {
    console.error('❌ Real-time Swiss data update failed:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}