// File: app/api/economic-health/route.js

import { NextResponse } from 'next/server';

async function getEconomicHealthData() {
  // Mock values
  const latestGDP = 1.9; // GDP Growth %
  const latestUnemployment = 2.3; // Unemployment Rate %

  const gdpHistory = [
    { date: 'Q3 2024', value: 1.5 }, { date: 'Q4 2024', value: 1.7 },
    { date: 'Q1 2025', value: 1.6 }, { date: 'Q2 2025', value: 1.9 },
  ];

  return {
    gdp: { value: latestGDP, historicalData: gdpHistory },
    unemployment: { value: latestUnemployment },
    source: "State Secretariat for Economic Affairs (SECO)",
    nextPublication: "Late August 2025",
  };
}

export async function GET(request) {
  try {
    const data = await getEconomicHealthData();
    let gdpScore = 0;
    let unemploymentScore = 0;

    // --- NEW SCORING LOGIC FOR GDP ---
    const gdp = data.gdp.value;
    if (gdp > 2.5) gdpScore = 2;
    else if (gdp > 1.5) gdpScore = 1;
    else if (gdp >= 0.5) gdpScore = 0;
    else if (gdp >= 0.0) gdpScore = -1;
    else gdpScore = -2;

    // --- NEW SCORING LOGIC FOR UNEMPLOYMENT ---
    const unemployment = data.unemployment.value;
    if (unemployment < 2.0) unemploymentScore = 2;
    else if (unemployment < 2.5) unemploymentScore = 1;
    else if (unemployment <= 3.5) unemploymentScore = 0;
    else if (unemployment <= 4.5) unemploymentScore = -1;
    else unemploymentScore = -2;
    
    // Add the scores to their respective data objects
    data.gdp.score = gdpScore;
    data.unemployment.score = unemploymentScore;
        
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch economic health data' }, { status: 500 });
  }
}