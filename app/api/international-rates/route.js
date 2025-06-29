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
    
    const ecbRate = rows[0].ecb_rate_value || 2.0;  // Default current ECB rate
    const fedRate = rows[0].fed_rate_value || 4.5;  // Default current Fed rate
    const ecbStance = rows[0].ecb_stance || 'hold_neutral';
    const fedStance = rows[0].fed_stance || 'hold_neutral';
    const nextMeeting = rows[0].next_meeting_date;
    const ecbUpdatedAt = rows[0].ecb_updated_at;
    const fedUpdatedAt = rows[0].fed_updated_at;
    
    // FIXED ECB SCORING LOGIC (based on policy stance)
    let ecbScore = 0;
    if (ecbStance === 'hike_aggressive') ecbScore = 2;
    else if (ecbStance === 'hike_moderate') ecbScore = 1;
    else if (ecbStance === 'hold_hawkish_bias') ecbScore = 1;
    else if (ecbStance === 'hold_neutral') ecbScore = 0;
    else if (ecbStance === 'hold_dovish_bias') ecbScore = -1;
    else if (ecbStance === 'cut_moderate') ecbScore = -1;
    else if (ecbStance === 'cut_aggressive') ecbScore = -2;
    else ecbScore = 0; // Default for unknown stances
    
    // FIXED FED SCORING LOGIC (based on policy stance)
    let fedScore = 0;
    if (fedStance === 'hike_aggressive') fedScore = 2;
    else if (fedStance === 'hike_moderate') fedScore = 1;
    else if (fedStance === 'hold_hawkish_bias') fedScore = 1;
    else if (fedStance === 'hold_neutral') fedScore = 0;
    else if (fedStance === 'hold_dovish_bias') fedScore = -1;
    else if (fedStance === 'cut_moderate') fedScore = -1;
    else if (fedStance === 'cut_aggressive') fedScore = -2;
    else fedScore = 0; // Default for unknown stances

    // Helper function to format stance for display
    const formatStance = (stance) => {
      const stanceMap = {
        'hike_aggressive': 'Hiking Aggressively (>50bp)',
        'hike_moderate': 'Hiking Moderately (25bp)',
        'hold_hawkish_bias': 'Holding (Hawkish)',
        'hold_neutral': 'On Hold',
        'hold_dovish_bias': 'Holding (Dovish)',
        'cut_moderate': 'Cutting Moderately (25bp)',
        'cut_aggressive': 'Cutting Aggressively (>50bp)'
      };
      return stanceMap[stance] || 'On Hold';
    };

    const responseData = {
      ecb: {
        rate: ecbRate,
        stance: formatStance(ecbStance),
        score: ecbScore,
        source: "FRED (Live)",
        nextPublication: "Monthly",
        updatedAt: ecbUpdatedAt,
        rawStance: ecbStance  // For debugging
      },
      fed: {
        rate: fedRate,
        stance: formatStance(fedStance),
        score: fedScore,
        source: "FRED (Live)",
        nextPublication: "Monthly",
        updatedAt: fedUpdatedAt,
        rawStance: fedStance  // For debugging
      },
      nextMeeting: nextMeeting
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('International rates API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}