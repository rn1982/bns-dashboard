import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await readRow();
    const { value: cpi, meta } = readIndicator(row, 'inflation');
    if (cpi === null) return NextResponse.json({ error: 'No inflation value stored yet', meta });

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

    const responseData = { 
      value: cpi, 
      score: score, 
      meta,
      nextPublication: "Monthly",
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