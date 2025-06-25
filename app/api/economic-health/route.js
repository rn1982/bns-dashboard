// File: /api/economic-health/route.js -- DATABASE VERSION
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT gdp_value, unemployment_value FROM latest_indicators WHERE id = 1;`;
    const { gdp_value, unemployment_value } = rows[0];

    let gdpScore = 0;
    if (gdp_value > 2.5) gdpScore = 2;
    else if (gdp_value > 1.5) gdpScore = 1;
    else if (gdp_value >= 0.5) gdpScore = 0;
    else if (gdp_value >= 0.0) gdpScore = -1;
    else gdpScore = -2;

    let unemploymentScore = 0;
    if (unemployment_value < 2.0) unemploymentScore = 2;
    else if (unemployment_value < 2.5) unemploymentScore = 1;
    else if (unemployment_value <= 3.5) unemploymentScore = 0;
    else if (unemployment_value <= 4.5) unemploymentScore = -1;
    else unemploymentScore = -2;

    const responseData = {
      gdp: { value: gdp_value, score: gdpScore },
      unemployment: { value: unemployment_value, score: unemploymentScore },
      source: "SECO (DB)", nextPublication: "Quarterly"
    };
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}