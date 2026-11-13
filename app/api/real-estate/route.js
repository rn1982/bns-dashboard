import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';
import { scoreRealEstate } from '../../lib/model';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await readRow();
    const { value: realEstateGrowth, meta } = readIndicator(row, 'real_estate');
    if (realEstateGrowth === null) return NextResponse.json({ error: 'No real estate value stored yet (manual only)', meta });

    // NEW SCORING LOGIC for Real Estate (Swiss IMPI)
    const score = scoreRealEstate(realEstateGrowth); // rules in app/lib/model.js

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