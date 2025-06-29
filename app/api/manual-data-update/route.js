import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📝 Manual data update received:', body);

    // Prepare SQL update parts
    const updateParts = [];
    
    if (body.inflation !== undefined) {
      updateParts.push(`inflation_value = ${parseFloat(body.inflation)}, inflation_updated_at = NOW()`);
    }

    if (body.snbRate !== undefined) {
      updateParts.push(`snb_policy_rate_value = ${parseFloat(body.snbRate)}, snb_updated_at = NOW()`);
    }

    if (body.gdp !== undefined) {
      updateParts.push(`gdp_value = ${parseFloat(body.gdp)}, gdp_updated_at = NOW()`);
    }

    if (body.unemployment !== undefined) {
      updateParts.push(`unemployment_value = ${parseFloat(body.unemployment)}, unemployment_updated_at = NOW()`);
    }

    if (body.realEstate !== undefined) {
      updateParts.push(`real_estate_value = ${parseFloat(body.realEstate)}, real_estate_updated_at = NOW()`);
    }

    if (updateParts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid data provided for update'
      }, { status: 400 });
    }

    // Execute the update using template literals
    const query = `UPDATE latest_indicators SET ${updateParts.join(', ')} WHERE id = 1`;
    
    await sql.query(query);

    console.log('✅ Manual data update completed');

    return NextResponse.json({
      success: true,
      message: 'Manual data update completed successfully',
      updatedFields: Object.keys(body),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual data update failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}