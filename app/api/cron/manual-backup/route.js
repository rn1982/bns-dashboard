import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('📝 Manual backup Swiss data update...');
    
    // MANUAL VERIFIED SWISS DATA (June 2025)
    // Update these values manually when you have new official data
    const manualData = {
      inflation: -0.1,      // May 2025: -0.1% YoY 
      snbRate: 0.0,         // June 20, 2025: 0.0%
      gdp: 1.25,            // SNB forecast midpoint
      unemployment: 2.8,    // Current level
      realEstate: 3.5,      // Current estimate
      ecbStance: "hold_neutral",
      fedStance: "hold_neutral",
      nextMeeting: "19 September 2025",
      saronFutures: 99.75,
      eurChf: 0.965
    };

    const impliedRate = 100 - manualData.saronFutures;
    const probability = 75;

    // Update database
    await sql`
      UPDATE latest_indicators
      SET 
        inflation_value = ${manualData.inflation},
        inflation_updated_at = NOW(),
        real_estate_value = ${manualData.realEstate},
        real_estate_updated_at = NOW(),
        unemployment_value = ${manualData.unemployment},
        unemployment_updated_at = NOW(),
        gdp_value = ${manualData.gdp},
        gdp_updated_at = NOW(),
        snb_policy_rate_value = ${manualData.snbRate},
        snb_updated_at = NOW(),
        next_meeting_date = ${manualData.nextMeeting},
        ecb_stance = ${manualData.ecbStance},
        fed_stance = ${manualData.fedStance},
        market_implied_rate = ${impliedRate},
        saron_futures_price = ${manualData.saronFutures},
        market_probability = ${probability}
      WHERE id = 1;
    `;
    
    return NextResponse.json({
      success: true,
      message: '📝 Manual backup data update completed',
      timestamp: new Date().toISOString(),
      dataQuality: 'MANUAL_VERIFIED',
      data: {
        ...manualData,
        impliedRate: parseFloat(impliedRate.toFixed(3)),
        probability
      },
      note: 'This route uses manually verified data. Update the values in the code when new official data is available.'
    });
    
  } catch (error) {
    console.error('❌ Manual backup update failed:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
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