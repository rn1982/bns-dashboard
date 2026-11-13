import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';

export const dynamic = 'force-dynamic';

// Professional SARON futures interpretation function
function interpretSARONFutures(currentSNBRate, futuresPrice) {
  // Step 1: Calculate implied rate
  const impliedRate = 100 - futuresPrice;
  
  // Step 2: Calculate expected change in basis points
  const expectedChangePercent = currentSNBRate - impliedRate;
  const expectedChangeBp = Math.round(expectedChangePercent * 100);
  
  // Step 3: Determine probability and signal strength
  let probability = 0;
  let moveSize = "";
  let direction = "";
  let signalStrength = "";
  let expectationText = "";
  
  if (expectedChangeBp > 0) {
    // Market expects CUTS (positive expectedChange)
    direction = "CUT";
    
    if (expectedChangeBp <= 5) {
      probability = 20;
      moveSize = "25bp";
      signalStrength = "Very weak";
    } else if (expectedChangeBp <= 10) {
      probability = 40;
      moveSize = "25bp";
      signalStrength = "Weak";
    } else if (expectedChangeBp <= 15) {
      probability = 60;
      moveSize = "25bp";
      signalStrength = "Moderate";
    } else if (expectedChangeBp <= 20) {
      probability = 80;
      moveSize = "25bp";
      signalStrength = "Strong";
    } else if (expectedChangeBp <= 30) {
      probability = 95;
      moveSize = "25bp";
      signalStrength = "Very strong";
    } else if (expectedChangeBp <= 40) {
      probability = 60;
      moveSize = "50bp";
      signalStrength = "Moderate";
    } else {
      probability = 80;
      moveSize = "50bp+";
      signalStrength = "Strong";
    }
    
    expectationText = `${signalStrength} ${direction} expected (${moveSize})`;
    
  } else if (expectedChangeBp < 0) {
    // Market expects HIKES (negative expectedChange)
    direction = "HIKE";
    const absBp = Math.abs(expectedChangeBp);
    
    if (absBp <= 5) {
      probability = 20;
      moveSize = "25bp";
      signalStrength = "Very weak";
    } else if (absBp <= 10) {
      probability = 40;
      moveSize = "25bp";
      signalStrength = "Weak";
    } else if (absBp <= 15) {
      probability = 60;
      moveSize = "25bp";
      signalStrength = "Moderate";
    } else if (absBp <= 20) {
      probability = 80;
      moveSize = "25bp";
      signalStrength = "Strong";
    } else if (absBp <= 30) {
      probability = 95;
      moveSize = "25bp";
      signalStrength = "Very strong";
    } else if (absBp <= 40) {
      probability = 60;
      moveSize = "50bp";
      signalStrength = "Moderate";
    } else {
      probability = 80;
      moveSize = "50bp+";
      signalStrength = "Strong";
    }
    
    expectationText = `${signalStrength} ${direction} expected (${moveSize})`;
    
  } else {
    // No change expected
    probability = 80;
    expectationText = "HOLD expected (no change)";
    signalStrength = "Strong";
    moveSize = "0bp";
    direction = "HOLD";
  }
  
  return {
    impliedRate: parseFloat(impliedRate.toFixed(3)),
    expectedChangeBp,
    probability,
    expectationText,
    signalStrength,
    moveSize,
    direction
  };
}

export async function GET() {
  try {
    const row = await readRow();
    const saron = readIndicator(row, 'saron_futures');
    const snb = readIndicator(row, 'snb_rate');
    const futuresPrice = saron.value;
    const currentSNBRate = snb.value;
    if (futuresPrice === null || currentSNBRate === null) {
      return NextResponse.json({
        error: futuresPrice === null ? 'No SARON futures price stored yet (manual only)' : 'No SNB policy rate stored yet',
        currentSNBRate,
        futuresPrice,
        saronMeta: saron.meta,
        snbMeta: snb.meta,
      });
    }

    const marketAnalysis = interpretSARONFutures(currentSNBRate, futuresPrice);

    const responseData = {
      currentSNBRate: currentSNBRate,
      futuresPrice: futuresPrice,
      impliedRate: marketAnalysis.impliedRate,
      expectedChangeBp: marketAnalysis.expectedChangeBp,
      probability: marketAnalysis.probability,
      expectationText: marketAnalysis.expectationText,
      signalStrength: marketAnalysis.signalStrength,
      moveSize: marketAnalysis.moveSize,
      direction: marketAnalysis.direction,
      saronMeta: saron.meta,
      snbMeta: snb.meta,
      description: "Professional market-implied SNB rate expectations",
      methodology: "Based on institutional SARON futures interpretation"
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Market expectations API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}