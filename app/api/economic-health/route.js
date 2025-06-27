import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get live economic data from database (populated by Swiss cron job)
    const { rows } = await sql`
      SELECT gdp_value, gdp_updated_at, unemployment_value, unemployment_updated_at 
      FROM latest_indicators WHERE id = 1;
    `;
    if (rows.length === 0) throw new Error("No economic health data found in database.");
    
    const gdpForecast = rows[0].gdp_value;
    const unemploymentRate = rows[0].unemployment_value;
    const gdpUpdatedAt = rows[0].gdp_updated_at;
    const unemploymentUpdatedAt = rows[0].unemployment_updated_at;
    
    // GDP Scoring Logic
    let gdpScore = 0;
    if (gdpForecast > 2.5) gdpScore = 2;      // Strong growth (rate hike pressure)
    else if (gdpForecast > 1.5) gdpScore = 1; // Moderate growth
    else if (gdpForecast >= 0.5) gdpScore = 0; // Weak growth
    else if (gdpForecast >= 0.0) gdpScore = -1; // Stagnation
    else gdpScore = -2;                       // Recession (rate cut pressure)
    
    // Unemployment Scoring Logic
    let unemploymentScore = 0;
    if (unemploymentRate < 2.0) unemploymentScore = 2;      // Very low (overheating)
    else if (unemploymentRate < 2.5) unemploymentScore = 1; // Low (healthy)
    else if (unemploymentRate <= 3.5) unemploymentScore = 0; // Normal range
    else if (unemploymentRate <= 4.5) unemploymentScore = -1; // Elevated
    else unemploymentScore = -2;                             // High (recession risk)

    const responseData = {
      gdp: {
        value: gdpForecast,
        score: gdpScore,
        source: "Swiss Sources (Live)",
        nextPublication: "Quarterly",
        updatedAt: gdpUpdatedAt
      },
      unemployment: {
        value: unemploymentRate,
        score: unemploymentScore,
        source: "Swiss Sources (Live)",
        nextPublication: "Monthly",
        updatedAt: unemploymentUpdatedAt
      }
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Economic health API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}