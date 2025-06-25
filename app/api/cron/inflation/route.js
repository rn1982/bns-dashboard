// File: /api/inflation/route.js -- DATABASE VERSION
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT inflation_value FROM latest_indicators WHERE id = 1;`;
    const cpi = rows[0].inflation_value;

    let score = 0;
    if (cpi > 2.5) score = 2;
    else if (cpi > 2.0) score = 1;
    else if (cpi >= 0.5) score = 0;
    else if (cpi >= 0.0) score = -1;
    else score = -2;

    const responseData = { value: cpi, score: score, source: "FSO (DB)", nextPublication: "Monthly" };
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}