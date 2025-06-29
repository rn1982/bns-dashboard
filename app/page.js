'use client';

import { useState, useEffect } from 'react';
import IndicatorCard from './components/IndicatorCard';
import ManualDataInput from './components/ManualDataInput';

// UPDATED WEIGHTS - New 7-indicator model
const WEIGHTS = {
  inflation: 0.30,     
  realEstate: 0.20,    
  exchangeRate: 0.15,  
  ecb: 0.15,           
  gdp: 0.10,           
  unemployment: 0.05,  
  fed: 0.05,           
};

export default function HomePage() {
  const [allData, setAllData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const [
          inflationRes, 
          realEstateRes,
          exchangeRateRes, 
          economicHealthRes, 
          internationalRatesRes,
          marketExpectationsRes
        ] = await Promise.all([
          fetch('/api/inflation').then(res => res.json()),
          fetch('/api/real-estate').then(res => res.json()),
          fetch('/api/exchange-rate').then(res => res.json()),
          fetch('/api/economic-health').then(res => res.json()),
          fetch('/api/international-rates').then(res => res.json()),
          fetch('/api/market-expectations').then(res => res.json())
        ]);
        
        setAllData({
          inflation: inflationRes,
          realEstate: realEstateRes,
          exchangeRate: exchangeRateRes,
          economicHealth: economicHealthRes,
          internationalRates: internationalRatesRes,
          marketExpectations: marketExpectationsRes,
        });
        
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const calculateFinalVerdict = () => {
    if (isLoading || Object.values(allData).some(d => !d || d.error)) {
      return null;
    }
    
    try {
      const inflationScore = allData.inflation?.score || 0;
      const realEstateScore = allData.realEstate?.score || 0;
      const exchangeRateScore = allData.exchangeRate?.score || 0;
      const gdpScore = allData.economicHealth?.gdp?.score || 0;
      const unemploymentScore = allData.economicHealth?.unemployment?.score || 0;
      const ecbScore = allData.internationalRates?.ecb?.score || 0;
      const fedScore = allData.internationalRates?.fed?.score || 0;
      
      const globalScore = 
        (inflationScore * WEIGHTS.inflation) +
        (realEstateScore * WEIGHTS.realEstate) +
        (exchangeRateScore * WEIGHTS.exchangeRate) +
        (gdpScore * WEIGHTS.gdp) +
        (unemploymentScore * WEIGHTS.unemployment) +
        (ecbScore * WEIGHTS.ecb) +
        (fedScore * WEIGHTS.fed);
      
      // UPDATED THRESHOLDS - More realistic for SNB behavior
      let verdict = {};
      if (globalScore >= 1.0) {
        verdict = { 
          text: 'Strong HIKE signal (50bp likely)', 
          bgColor: 'bg-red-200', 
          textColor: 'text-red-900', 
          borderColor: 'border-red-400' 
        };
      } else if (globalScore >= 0.5) {
        verdict = { 
          text: 'Moderate HIKE signal (25bp likely)', 
          bgColor: 'bg-red-100', 
          textColor: 'text-red-800', 
          borderColor: 'border-red-300' 
        };
      } else if (globalScore > -0.5) {
        verdict = { 
          text: 'HOLD (no change expected)', 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-800', 
          borderColor: 'border-gray-300' 
        };
      } else if (globalScore > -1.0) {
        verdict = { 
          text: 'Moderate CUT signal (25bp likely)', 
          bgColor: 'bg-green-100', 
          textColor: 'text-green-800', 
          borderColor: 'border-green-300' 
        };
      } else {
        verdict = { 
          text: 'Strong CUT signal (50bp possible)', 
          bgColor: 'bg-green-200', 
          textColor: 'text-green-900', 
          borderColor: 'border-green-400' 
        };
      }
      
      return { 
        ...verdict, 
        score: globalScore.toFixed(2), 
        nextMeeting: allData.internationalRates?.nextMeeting || "TBD"
      };
    } catch (e) { 
      return null; 
    }
  };

  const finalVerdict = calculateFinalVerdict();
  const marketExpectation = allData.marketExpectations;

  // Helper function to get market vs model comparison
  const getMarketModelComparison = () => {
    if (!finalVerdict || !marketExpectation || marketExpectation.error) return null;
    
    const modelDirection = finalVerdict.text.includes('HIKE') ? 'HIKE' : 
                          finalVerdict.text.includes('CUT') ? 'CUT' : 'HOLD';
    const marketDirection = marketExpectation.direction;
    
    if (modelDirection === marketDirection) {
      return { status: 'ALIGNED', message: 'Model and market agree', color: 'text-green-600' };
    } else {
      return { status: 'DIVERGED', message: 'Model vs market divergence!', color: 'text-red-600' };
    }
  };

  const comparison = getMarketModelComparison();

  if (error) {
    return (
      <main className="bg-gray-50 min-h-screen p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            SNB Monetary Policy Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Professional forecasting with real estate prices and SARON futures analysis.
          </p>
        </header>

        {/* Manual Data Input Component */}
        <ManualDataInput />

        {/* Model Forecast */}
        <div className="mb-6">
          {finalVerdict ? (
            <div className={`border-l-4 ${finalVerdict.borderColor} ${finalVerdict.bgColor} p-4 rounded-r-lg shadow`}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${finalVerdict.textColor}`}>
                    Model Forecast
                  </h2>
                  <p className={`text-2xl font-bold mt-1 ${finalVerdict.textColor}`}>
                    {finalVerdict.text}
                  </p>
                  <p className={`text-sm font-semibold mt-1 ${finalVerdict.textColor}`}>
                    Global Weighted Score: {finalVerdict.score}
                  </p>
                </div>
                {finalVerdict.nextMeeting && (
                  <div className="text-right">
                    <h3 className={`text-sm font-bold ${finalVerdict.textColor}`}>
                      NEXT SNB MEETING
                    </h3>
                    <p className={`text-lg font-semibold ${finalVerdict.textColor}`}>
                      {finalVerdict.nextMeeting}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-lg animate-pulse h-24 flex items-center justify-center">
              <span className="text-gray-600">
                {isLoading ? "Loading data..." : "Calculating forecast..."}
              </span>
            </div>
          )}
        </div>

        {/* Enhanced Market Expectations with Professional SARON Analysis */}
        {marketExpectation && !marketExpectation.error && (
          <div className="mb-8">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-blue-900">
                    Market Expectations (SARON Futures)
                  </h2>
                  <p className="text-xl font-bold mt-1 text-blue-800">
                    {marketExpectation.expectationText}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-blue-700">
                        <span className="font-semibold">Probability:</span> {marketExpectation.probability}%
                      </p>
                      <p className="text-blue-700">
                        <span className="font-semibold">Expected:</span> {marketExpectation.expectedChangeBp}bp
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700">
                        <span className="font-semibold">Signal:</span> {marketExpectation.signalStrength}
                      </p>
                      <p className="text-blue-700">
                        <span className="font-semibold">Move Size:</span> {marketExpectation.moveSize}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <h3 className="text-sm font-bold text-blue-900">FUTURES DATA</h3>
                  <p className="text-lg font-semibold text-blue-800">
                    {marketExpectation.futuresPrice}
                  </p>
                  <p className="text-xs text-blue-600">
                    Implied: {marketExpectation.impliedRate}%
                  </p>
                  <p className="text-xs text-blue-600">
                    Current: {marketExpectation.currentSNBRate}%
                  </p>
                </div>
              </div>
              
              {/* Model vs Market Comparison */}
              {comparison && (
                <div className="mt-4 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">Model vs Market:</span>
                    <span className={`text-sm font-bold ${comparison.color}`}>
                      {comparison.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Indicator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <IndicatorCard title="1. Inflation (30%)" data={allData.inflation} />
          <IndicatorCard title="2. Real Estate (20%)" data={allData.realEstate} />
          <IndicatorCard title="3. EUR/CHF (15%)" data={allData.exchangeRate} />
          <IndicatorCard title="4. ECB Policy (15%)" data={allData.internationalRates?.ecb} />
          <IndicatorCard title="5. GDP Growth (10%)" data={allData.economicHealth?.gdp} />
          <IndicatorCard title="6. Unemployment (5%)" data={allData.economicHealth?.unemployment} />
          <IndicatorCard title="7. Fed Policy (5%)" data={allData.internationalRates?.fed} />
        </div>
        
        <footer className="text-center mt-12 text-sm text-gray-500">
          <p>Professional SNB analysis with institutional-grade SARON futures interpretation. For informational purposes only.</p>
        </footer>
      </div>
    </main>
  );
}