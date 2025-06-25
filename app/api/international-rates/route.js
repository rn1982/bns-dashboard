// File: app/api/international-rates/route.js

import { NextResponse } from 'next/server';

async function getInternationalRatesData() {
  const ecbRate = 4.25;
  const fedRate = 5.50;
  
  // Mocking the policy stance. In a real app, this might be set manually or by a more complex script.
  const ecbStance = 'cut_last_3_months'; // Corresponds to a score of -2
  const fedStance = 'hold_hawkish_bias';  // Corresponds to a score of +1

  return {
    ecb: { value: ecbRate, stance: ecbStance },
    fed: { value: fedRate, stance: fedStance },
    source: "ECB & Federal Reserve",
    nextPublication: "See official calendars",
  };
}

// Helper function to convert stance to score
const getStanceScore = (stance) => {
  if (stance === 'hike_last_3_months' || stance === 'explicit_hawkish') return 2;
  if (stance === 'hold_hawkish_bias') return 1;
  if (stance === 'hold_neutral') return 0;
  if (stance === 'hold_dovish_bias') return -1;
  if (stance === 'cut_last_3_months' || stance === 'explicit_dovish') return -2;
  return 0; // Default to neutral
};

export async function GET(request) {
  try {
    const data = await getInternationalRatesData();
    
    // Calculate score for each central bank
    const ecbScore = getStanceScore(data.ecb.stance);
    const fedScore = getStanceScore(data.fed.stance);
    
    // Add scores to the data object
    data.ecb.score = ecbScore;
    data.fed.score = fedScore;
        
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch international rates data' }, { status: 500 });
  }
}