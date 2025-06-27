import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ALPHA_VANTAGE_API_KEY not found.' }, { status: 500 });
  }

  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=EUR&to_currency=CHF&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const rate = data['Realtime Currency Exchange Rate']['5. Exchange Rate'];
    const value = 1 / parseFloat(rate); // Convert from CHF per EUR to EUR per CHF

    await sql`
      UPDATE latest_indicators 
      SET exchange_rate_value = ${value}, exchange_rate_updated_at = NOW() 
      WHERE id = 1;
    `;
    
    return NextResponse.json({ 
      message: 'Exchange rate updated from Alpha Vantage.', 
      value: value.toFixed(4)
    });
  } catch (error) {
    return NextResponse.json({ 
      error: `Alpha Vantage Error: ${error.message}` 
    }, { status: 500 });
  }
}