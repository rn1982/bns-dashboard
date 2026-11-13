import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await readRow();
    const { value: realEstateGrowth, meta } = readIndicator(row, 'real_estate');
    if (realEstateGrowth === null) return NextResponse.json({ error: 'No real estate value stored yet (manual only)', meta });

    // NEW SCORING LOGIC for Real Estate (Swiss IMPI)
    let score = 0;
    if (realEstateGrowth > 6.0) score = 2;      // Above 6% YoY growth
    else if (realEstateGrowth > 4.0) score = 1; // 4% to 6% growth  
    else if (realEstateGrowth >= 2.0) score = 0; // 2% to 4% growth (normal)
    else if (realEstateGrowth >= 0.0) score = -1; // 0% to 2% growth (weak)
    else score = -2;                             // Negative growth (bubble bursting)

    const responseData = { 
      value: realEstateGrowth,
      score: score,
      meta,
      nextPublication: "Quarterly",
      description: "Swiss Residential Property Price Index YoY growth"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Real Estate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}