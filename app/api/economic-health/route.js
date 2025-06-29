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
    
    // UPDATED GDP SCORING LOGIC
    let gdpScore = 0;
    if (gdpForecast > 2.5) gdpScore = 2;      // Above 2.5% YoY (overheating) - hike pressure
    else if (gdpForecast > 2.0) gdpScore = 1; // 2.0% to 2.5% - strong growth
    else if (gdpForecast >= 1.0) gdpScore = 0; // 1.0% to 2.0% (trend growth) - neutral
    else if (gdpForecast >= 0.0) gdpScore = -1; // 0% to 1.0% - weak growth
    else gdpScore = -2;                       // Negative growth (recession) - cut pressure
    
    // UPDATED UNEMPLOYMENT SCORING LOGIC (Swiss-specific thresholds)
    let unemploymentScore = 0;
    if (unemploymentRate < 2.0) unemploymentScore = 2;      // Below 2.0% (labor shortage) - hike pressure
    else if (unemploymentRate < 2.5) unemploymentScore = 1; // 2.0% to 2.5% - very low unemployment
    else if (unemploymentRate <= 3.5) unemploymentScore = 0; // 2.5% to 3.5% (normal for Switzerland)
    else if (unemploymentRate <= 4.5) unemploymentScore = -1; // 3.5% to 4.5% - elevated unemployment
    else unemploymentScore = -2;                             // Above 4.5% (very high for CH) - cut pressure

    const responseData = {
      gdp: {
        value: gdpForecast,
        score: gdpScore,
        source: "Swiss Sources (Live)",
        nextPublication: "Quarterly",
        updatedAt: gdpUpdatedAt,
        description: "Swiss GDP growth forecast YoY"
      },
      unemployment: {
        value: unemploymentRate,
        score: unemploymentScore,
        source: "Swiss Sources (Live)",
        nextPublication: "Monthly",
        updatedAt: unemploymentUpdatedAt,
        description: "Swiss unemployment rate (seasonally adjusted)"
      }
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Economic health API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}