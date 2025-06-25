// File: /app/api/inflation/route.js

import { NextResponse } from 'next/server';

async function getInflationData() {
  // Current mock value for CPI
  const latestCPI = 1.4; // Example: 1.4%

  // History for the chart
  const history = [
    { date: '2024-06', value: 1.5 }, { date: '2024-07', value: 1.6 },
    { date: '2024-08', value: 1.5 }, { date: '2024-09', value: 1.4 },
    { date: '2024-10', value: 1.3 }, { date: '2024-11', value: 1.2 },
    { date: '2024-12', value: 1.3 }, { date: '2025-01', value: 1.1 },
    { date: '2025-02', value: 1.2 }, { date: '2025-03', value: 1.3 },
    { date: '2025-04', value: 1.4 }, { date: '2025-05', value: 1.4 },
  ];

  return {
    value: latestCPI,
    source: "Federal Statistical Office (FSO)",
    nextPublication: "Early July 2025",
    historicalData: history,
  };
}

export async function GET(request) {
  try {
    const data = await getInflationData();
    let score = 0; // Default score

    // --- NEW SCORING LOGIC ---
    const cpi = data.value;
    if (cpi > 2.5) {
      score = 2;
    } else if (cpi > 2.0) {
      score = 1;
    } else if (cpi >= 0.5) {
      score = 0;
    } else if (cpi >= 0.0) {
      score = -1;
    } else {
      score = -2;
    }

    // The response now includes the calculated score
    const responseData = { ...data, score: score };

    return NextResponse.json(responseData);

  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch inflation data' }, { status: 500 });
  }
}