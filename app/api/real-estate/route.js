import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get real estate data from database
    const { rows } = await sql`
      SELECT real_estate_value, real_estate_updated_at 
      FROM latest_indicators WHERE id = 1;
    `;
    if (rows.length === 0) throw new Error("No real estate data found in database.");
    
    const realEstateGrowth = rows[0].real_estate_value;
    const updatedAt = rows[0].real_estate_updated_at;
    
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
      source: "Swiss National Bank (IMPI)",
      nextPublication: "Quarterly",
      updatedAt: updatedAt,
      description: "Swiss Residential Property Price Index YoY growth"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Real Estate API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}