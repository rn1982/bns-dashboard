import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';
import { scoreExchangeRate } from '../../lib/model';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await readRow();
    const { value: rate, meta } = readIndicator(row, 'exchange_rate');
    if (rate === null) return NextResponse.json({ error: 'No EUR/CHF value stored yet', meta });

    // OPTIMIZED SNB LOGIC - Based on 2000-2025 Backtesting
    // Asymmetric response: SNB more aggressive against CHF strength than weakness
    // CHF fort (low EUR/CHF) = CUT pressure (competitiveness concerns)
    // CHF faible (high EUR/CHF) = HIKE pressure (inflation risk from imports)
    const score = scoreExchangeRate(rate); // rules in app/lib/model.js
    
    // Enhanced interpretation with intervention risk assessment
    let interpretation = "";
    let interventionRisk = "";
    let historicalContext = "";
    
    if (score === 2) {
      interpretation = `EUR/CHF at ${rate} - CHF very weak, imported inflation risk`;
      interventionRisk = "LOW - SNB comfortable, can tighten policy";
      historicalContext = "SNB can afford to raise rates when CHF is weak";
    } else if (score === 1) {
      interpretation = `EUR/CHF at ${rate} - CHF weakening, manageable for SNB`;
      interventionRisk = "LOW - Within acceptable range for Swiss economy";
      historicalContext = "CHF weakness helps exports, limited inflation risk";
    } else if (score === 0) {
      interpretation = `EUR/CHF at ${rate} - Balanced level, optimal for Swiss economy`;
      interventionRisk = "MINIMAL - SNB comfort zone for monetary policy";
      historicalContext = "CHF at level that balances competitiveness and price stability";
    } else if (score === -1) {
      interpretation = `CHF strong at ${rate} - Export competitiveness concerns mounting`;
      interventionRisk = "MODERATE - SNB monitoring closely, verbal intervention possible";
      historicalContext = "Approaching levels where SNB expressed concern (2022-2024 pattern)";
    } else {
      interpretation = `CHF very strong at ${rate} - Urgent competitiveness crisis`;
      interventionRisk = "HIGH - Active SNB intervention likely";
      historicalContext = "Similar to 2011-2015: SNB introduced 1.20 floor + negative rates";
    }
    
    const responseData = { 
      value: parseFloat(rate.toFixed(4)),
      score: score, 
      meta,
      nextPublication: "Daily (ECB reference rate, ~16:00 CET)",
      description: "EUR/CHF exchange rate - Asymmetric SNB response to CHF strength",
      interpretation: interpretation,
      interventionRisk: interventionRisk,
      historicalContext: historicalContext,
      thresholds: {
        "+2": "> 1.00 (CHF very weak - inflation risk)",
        "+1": "0.98 to 1.00 (CHF weak)",
        "0": "0.96 to 0.98 (Equilibrium zone)",
        "-1": "0.94 to 0.96 (CHF strong - export pressure)", 
        "-2": "< 0.94 (CHF very strong - intervention risk)"
      },
      optimizationNote: "Asymmetric thresholds: SNB intervenes earlier at 0.94 vs 0.93 (2000-2025 analysis)",
      snbLogic: "Strong CHF = Export pressure → Rate cuts (2011-2015 + 2022-2024 precedent)"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}