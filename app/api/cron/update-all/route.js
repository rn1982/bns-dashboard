import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Determine base URL for API calls
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    console.log('Starting master cron job...');

    // Call all individual cron jobs in sequence
    const results = {};

    // 1. Update Swiss data (inflation, GDP, unemployment, SNB rate, stances)
    try {
      const swissResponse = await fetch(`${baseUrl}/api/cron/update-swiss-data`);
      results.swissData = await swissResponse.json();
    } catch (error) {
      results.swissData = { error: error.message };
    }

    // 2. Update FRED data (ECB & Fed rates)
    try {
      const fredResponse = await fetch(`${baseUrl}/api/cron/update-fred`);
      results.fredData = await fredResponse.json();
    } catch (error) {
      results.fredData = { error: error.message };
    }

    // 3. Update exchange rate
    try {
      const exchangeResponse = await fetch(`${baseUrl}/api/cron/update-exchange-rate`);
      results.exchangeData = await exchangeResponse.json();
    } catch (error) {
      results.exchangeData = { error: error.message };
    }

    console.log('Master cron job completed');

    return NextResponse.json({ 
      message: 'All data sources updated via master cron job',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Master Cron Error:', error);
    return NextResponse.json({ 
      error: `Master Cron Error: ${error.message}` 
    }, { status: 500 });
  }
}