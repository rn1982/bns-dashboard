import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get live inflation data from database (populated by cron job)
    const { rows } = await sql`SELECT inflation_value, inflation_updated_at FROM latest_indicators WHERE id = 1;`;
    if (rows.length === 0) throw new Error("No inflation data found in database.");
    
    const cpi = rows[0].inflation_value;
    const updatedAt = rows[0].inflation_updated_at;
    
    // OPTIMIZED SCORING LOGIC - Based on 2000-2025 Backtesting
    // SNB acts preemptively before inflation reaches 2.0%
    let score = 0;
    if (cpi > 2.5) score = 2;        // > 2.5%: Overheating, strong hike pressure
    else if (cpi >= 1.8) score = 1;  // 1.8% to 2.5%: Above comfort zone, SNB preemptive action
    else if (cpi >= 0.7) score = 0;  // 0.7% to 1.8%: Price stability target zone
    else if (cpi >= 0.0) score = -1; // 0.0% to 0.7%: Low inflation
    else score = -2;                 // < 0.0%: Deflationary risk, clear cut pressure

    // Enhanced interpretation based on optimized thresholds
    let interpretation = "";
    if (score === 2) {
      interpretation = `Inflation at ${cpi}% - Above SNB tolerance, strong hike pressure`;
    } else if (score === 1) {
      interpretation = `Inflation at ${cpi}% - Above comfort zone, SNB likely to act preemptively`;
    } else if (score === 0) {
      interpretation = `Inflation at ${cpi}% - Within SNB price stability target zone`;
    } else if (score === -1) {
      interpretation = `Inflation at ${cpi}% - Below target, some easing pressure`;
    } else {
      interpretation = `Inflation at ${cpi}% - Deflationary risk, clear cut pressure`;
    }

    // Historical data for the chart (enhanced with live data)
    const history = [
      { date: '2024-06', value: 1.5 }, 
      { date: '2024-07', value: 1.6 },
      { date: '2024-08', value: 1.5 }, 
      { date: '2024-09', value: 1.4 },
      { date: '2024-10', value: 1.3 }, 
      { date: '2024-11', value: 1.2 },
      { date: '2024-12', value: 1.3 }, 
      { date: '2025-01', value: 1.1 },
      { date: '2025-02', value: 1.2 }, 
      { date: '2025-03', value: 1.3 },
      { date: '2025-04', value: 0.0 }, 
      { date: '2025-05', value: cpi }, // Use live data for latest point
    ];

    const responseData = { 
      value: cpi, 
      score: score, 
      source: "Swiss FSO (Live)", 
      nextPublication: "Monthly",
      updatedAt: updatedAt,
      historicalData: history,
      description: "Swiss CPI inflation rate (YoY %) - Optimized thresholds",
      interpretation: interpretation,
      thresholds: {
        "+2": "> 2.5% (Overheating)",
        "+1": "1.8% to 2.5% (Above comfort zone - SNB preemptive action)", 
        "0": "0.7% to 1.8% (Price stability target zone)",
        "-1": "0.0% to 0.7% (Low inflation)",
        "-2": "< 0.0% (Deflationary risk)"
      },
      optimizationNote: "Thresholds lowered: SNB acts preemptively at 1.8% vs 2.0% (2000-2025 backtesting)"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Inflation API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}