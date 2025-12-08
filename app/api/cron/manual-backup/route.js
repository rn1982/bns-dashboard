import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  // DISABLED: This GET handler used to overwrite database with hardcoded "June 2025" data.
  // It has been disabled to prevent overwriting valid manual/live data.
  // Use the POST method or the Admin UI to update data manually.

  return NextResponse.json({
    success: true,
    message: 'Manual backup GET update is disabled to protect data integrity.',
    note: 'Use POST /api/cron/manual-data-update to update values.'
  });
}

// POST method to update specific values manually
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📝 Manual data update with custom values...');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (body.inflation !== undefined) {
      updates.push(`inflation_value = $${paramCount++}`, `inflation_updated_at = NOW()`);
      values.push(parseFloat(body.inflation));
    }

    if (body.snbRate !== undefined) {
      updates.push(`snb_policy_rate_value = $${paramCount++}`, `snb_updated_at = NOW()`);
      values.push(parseFloat(body.snbRate));
    }

    if (body.gdp !== undefined) {
      updates.push(`gdp_value = $${paramCount++}`, `gdp_updated_at = NOW()`);
      values.push(parseFloat(body.gdp));
    }

    if (body.unemployment !== undefined) {
      updates.push(`unemployment_value = $${paramCount++}`, `unemployment_updated_at = NOW()`);
      values.push(parseFloat(body.unemployment));
    }

    if (body.realEstate !== undefined) {
      updates.push(`real_estate_value = $${paramCount++}`, `real_estate_updated_at = NOW()`);
      values.push(parseFloat(body.realEstate));
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid data provided. Send JSON with inflation, snbRate, gdp, unemployment, or realEstate'
      }, { status: 400 });
    }

    const query = `UPDATE latest_indicators SET ${updates.join(', ')} WHERE id = 1`;
    await sql.query(query, values);

    return NextResponse.json({
      success: true,
      message: '📝 Custom manual data update completed',
      updatedFields: Object.keys(body),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}