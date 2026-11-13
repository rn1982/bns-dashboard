import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';
import { scoreGdp, scoreUnemployment } from '../../lib/model'; // scoring rules live there

export const dynamic = 'force-dynamic';

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
