import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';

export const dynamic = 'force-dynamic';

function scoreGdp(g) {
  if (g > 2.5) return 2;   // Above 2.5% YoY (overheating) - hike pressure
  if (g > 2.0) return 1;   // 2.0% to 2.5% - strong growth
  if (g >= 1.0) return 0;  // 1.0% to 2.0% (trend growth) - neutral
  if (g >= 0.0) return -1; // 0% to 1.0% - weak growth
  return -2;               // Negative growth (recession) - cut pressure
}

// Swiss-specific thresholds: Swiss unemployment is structurally low.
function scoreUnemployment(u) {
  if (u < 2.0) return 2;   // Below 2.0% (labour shortage) - hike pressure
  if (u < 2.5) return 1;   // 2.0% to 2.5% - very low
  if (u <= 3.5) return 0;  // 2.5% to 3.5% (normal for Switzerland)
  if (u <= 4.5) return -1; // 3.5% to 4.5% - elevated
  return -2;               // Above 4.5% (very high for CH) - cut pressure
}

export async function GET() {
  try {
    const row = await readRow();
    const gdp = readIndicator(row, 'gdp');
    const un = readIndicator(row, 'unemployment');

    return NextResponse.json({
      gdp: gdp.value === null
        ? { error: 'No GDP value stored yet', meta: gdp.meta }
        : {
            value: gdp.value,
            score: scoreGdp(gdp.value),
            meta: gdp.meta,
            nextPublication: 'Quarterly',
            description: 'Swiss real GDP growth, YoY %',
          },
      unemployment: un.value === null
        ? { error: 'No unemployment value stored yet', meta: un.meta }
        : {
            value: un.value,
            score: scoreUnemployment(un.value),
            meta: un.meta,
            nextPublication: 'Monthly',
            description: 'Swiss unemployment rate (seasonally adjusted)',
          },
    });
  } catch (error) {
    console.error('Economic health API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
