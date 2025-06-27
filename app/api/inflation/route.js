import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get live inflation data from database (populated by cron job)
    const { rows } = await sql`SELECT inflation_value, inflation_updated_at FROM latest_indicators WHERE id = 1;`;
    if (rows.length === 0) throw new Error("No inflation data found in database.");
    
    const cpi = rows[0].inflation_value;
    const updatedAt = rows[0].inflation_updated_at;
    
    // Your existing scoring logic (this is perfect - keep it!)
    let score = 0;
    if (cpi > 2.5) score = 2;
    else if (cpi > 2.0) score = 1;
    else if (cpi >= 0.5) score = 0;
    else if (cpi >= 0.0) score = -1;
    else score = -2;

    // Historical data for the chart (enhanced with live data)
    const history = [
      { date: '2024-06', value: 1.5 }, { date: '2024-07', value: 1.6 },
      { date: '2024-08', value: 1.5 }, { date: '2024-09', value: 1.4 },
      { date: '2024-10', value: 1.3 }, { date: '2024-11', value: 1.2 },
      { date: '2024-12', value: 1.3 }, { date: '2025-01', value: 1.1 },
      { date: '2025-02', value: 1.2 }, { date: '2025-03', value: 1.3 },
      { date: '2025-04', value: 0.0 }, { date: '2025-05', value: cpi }, // Use live data for latest points
    ];

    const responseData = { 
      value: cpi, 
      score: score, 
      source: "Swiss FSO (Live)", 
      nextPublication: "Monthly",
      updatedAt: updatedAt,
      historicalData: history
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Inflation API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}