// File: /api/international-rates/route.js -- DATABASE VERSION
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

const getStanceScore = (stance) => {
    if (stance === 'hike_last_3_months' || stance === 'explicit_hawkish') return 2;
    if (stance === 'hold_hawkish_bias') return 1;
    if (stance === 'hold_neutral') return 0;
    if (stance === 'hold_dovish_bias') return -1;
    if (stance === 'cut_last_3_months' || stance === 'explicit_dovish') return -2;
    return 0;
};

export async function GET() {
  try {
    // For now, we are not storing stance in the DB, so we'll use mock stances
    const mockEcbStance = 'cut_last_3_months';
    const mockFedStance = 'hold_hawkish_bias';
    
    const { rows } = await sql`SELECT ecb_rate_value, fed_rate_value FROM latest_indicators WHERE id = 1;`;
    const { ecb_rate_value, fed_rate_value } = rows[0];

    const ecbScore = getStanceScore(mockEcbStance);
    const fedScore = getStanceScore(mockFedStance);

    const responseData = {
      ecb: { value: ecb_rate_value, score: ecbScore },
      fed: { value: fed_rate_value, score: fedScore },
      source: "ECB & Fed (DB)", nextPublication: "See calendars"
    };
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}