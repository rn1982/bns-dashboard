import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('�� Manual data update received:', body);

    if (body.inflation !== undefined) {
      await sql`
        UPDATE latest_indicators 
        SET inflation_value = ${parseFloat(body.inflation)}, inflation_updated_at = NOW()
        WHERE id = 1;
      `;
    }

    if (body.snbRate !== undefined) {
      await sql`
        UPDATE latest_indicators 
        SET snb_policy_rate_value = ${parseFloat(body.snbRate)}, snb_updated_at = NOW()
        WHERE id = 1;
      `;
    }

    if (body.gdp !== undefined) {
      await sql`
        UPDATE latest_indicators 
        SET gdp_value = ${parseFloat(body.gdp)}, gdp_updated_at = NOW()
        WHERE id = 1;
      `;
    }

    if (body.unemployment !== undefined) {
      await sql`
        UPDATE latest_indicators 
        SET unemployment_value = ${parseFloat(body.unemployment)}, unemployment_updated_at = NOW()
        WHERE id = 1;
      `;
    }

    if (body.realEstate !== undefined) {
      await sql`
        UPDATE latest_indicators 
        SET real_estate_value = ${parseFloat(body.realEstate)}, real_estate_updated_at = NOW()
        WHERE id = 1;
      `;
    }

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
