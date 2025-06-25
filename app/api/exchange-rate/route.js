// File: app/api/exchange-rate/route.js

import { NextResponse } from 'next/server';

async function getExchangeRateData() {
  const latestEURCHF = 0.9750; // Mock Value: 0.9750

  const history = [
    { date: '2025-04-01', value: 0.9810 },
    { date: '2025-04-15', value: 0.9750 },
    { date: '2025-05-01', value: 0.9780 },
    { date: '2025-05-15', value: 0.9720 },
    { date: '2025-06-01', value: 0.9690 },
    { date: '2025-06-25', value: 0.9750 },
  ];

  return {
    value: latestEURCHF,
    source: "European Central Bank (ECB) Data",
    nextPublication: "Daily",
    historicalData: history,
  };
}

export async function GET(request) {
  try {
    const data = await getExchangeRateData();
    let score = 0;

    // --- NEW SCORING LOGIC ---
    const rate = data.value;
    if (rate > 1.05) {
      score = 2;
    } else if (rate > 1.00) {
      score = 1;
    } else if (rate >= 0.96) {
      score = 0;
    } else if (rate >= 0.92) {
      score = -1;
    } else {
      score = -2;
    }

    const responseData = { ...data, score: score };
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch exchange rate data' }, { status: 500 });
  }
}