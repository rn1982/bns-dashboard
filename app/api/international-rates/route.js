import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT ecb_rate_value, ecb_updated_at, fed_rate_value, fed_updated_at, 
             ecb_stance, fed_stance, next_meeting_date 
      FROM latest_indicators WHERE id = 1;
    `;
    if (rows.length === 0) throw new Error("No international rates data found in database.");
    
    const ecbRate = rows[0].ecb_rate_value;
    const fedRate = rows[0].fed_rate_value;
    const ecbStance = rows[0].ecb_stance;
    const fedStance = rows[0].fed_stance;
    const nextMeeting = rows[0].next_meeting_date;
    const ecbUpdatedAt = rows[0].ecb_updated_at;
    const fedUpdatedAt = rows[0].fed_updated_at;
    
    // ECB Scoring Logic (based on stance and rate level)
    let ecbScore = 0;
    if (ecbStance === 'hike_last_3_months') ecbScore = 2;
    else if (ecbStance === 'hold_hawkish_bias') ecbScore = 1;
    else if (ecbStance === 'hold_neutral') ecbScore = 0;
    else if (ecbStance === 'hold_dovish_bias') ecbScore = -1;
    else if (ecbStance === 'cut_last_3_months') ecbScore = -2;
    
    // Fed Scoring Logic (based on stance and rate level)
    let fedScore = 0;
    if (fedStance === 'hike_last_3_months') fedScore = 2;
    else if (fedStance === 'hold_hawkish_bias') fedScore = 1;
    else if (fedStance === 'hold_neutral') fedScore = 0;
    else if (fedStance === 'hold_dovish_bias') fedScore = -1;
    else if (fedStance === 'cut_last_3_months') fedScore = -2;

    // Helper function to format stance for display
    const formatStance = (stance) => {
      const stanceMap = {
        'hike_last_3_months': 'Recently Hiking',
        'hold_hawkish_bias': 'Holding (Hawkish)',
        'hold_neutral': 'Holding (Neutral)',
        'hold_dovish_bias': 'Holding (Dovish)',
        'cut_last_3_months': 'Recently Cutting'
      };
      return stanceMap[stance] || stance;
    };

    const responseData = {
      ecb: {
        rate: ecbRate,
        stance: formatStance(ecbStance),
        score: ecbScore,
        source: "FRED (Live)",
        nextPublication: "Monthly",
        updatedAt: ecbUpdatedAt
      },
      fed: {
        rate: fedRate,
        stance: formatStance(fedStance),
        score: fedScore,
        source: "FRED (Live)",
        nextPublication: "Monthly",
        updatedAt: fedUpdatedAt
      },
      nextMeeting: nextMeeting
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('International rates API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}