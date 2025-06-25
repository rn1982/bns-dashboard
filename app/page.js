'use client';

import { useState, useEffect } from 'react';
import IndicatorCard from './components/IndicatorCard';

// Your defined weights, stored as constants
const WEIGHTS = {
  inflation: 0.35,
  exchangeRate: 0.25,
  ecb: 0.15,
  gdp: 0.10,
  fed: 0.10,
  unemployment: 0.05,
};

export default function HomePage() {
  const [allData, setAllData] = useState({
    inflation: null,
    exchangeRate: null,
    economicHealth: null,
    internationalRates: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [
          inflationRes, exchangeRateRes, economicHealthRes, internationalRatesRes
        ] = await Promise.all([
          fetch('/api/inflation'), fetch('/api/exchange-rate'),
          fetch('/api/economic-health'), fetch('/api/international-rates')
        ]);
        
        setAllData({
          inflation: await inflationRes.json(),
          exchangeRate: await exchangeRateRes.json(),
          economicHealth: await economicHealthRes.json(),
          internationalRates: await internationalRatesRes.json(),
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const calculateFinalVerdict = () => {
    if (isLoading || Object.values(allData).some(d => d === null)) {
      return null;
    }

    try {
      const globalScore = 
        (allData.inflation.score * WEIGHTS.inflation) +
        (allData.exchangeRate.score * WEIGHTS.exchangeRate) +
        (allData.economicHealth.gdp.score * WEIGHTS.gdp) +
        (allData.economicHealth.unemployment.score * WEIGHTS.unemployment) +
        (allData.internationalRates.ecb.score * WEIGHTS.ecb) +
        (allData.internationalRates.fed.score * WEIGHTS.fed);

      let verdict = {};
      if (globalScore >= 0.7) {
        verdict = { text: 'Strong HIKE signal', bgColor: 'bg-red-200', textColor: 'text-red-900', borderColor: 'border-red-400' };
      } else if (globalScore >= 0.2) {
        verdict = { text: 'Moderate HIKE signal', bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-300' };
      } else if (globalScore > -0.2) {
        verdict = { text: 'Rates likely STABLE', bgColor: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-300' };
      } else if (globalScore > -0.7) {
        verdict = { text: 'Moderate CUT signal', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-300' };
      } else {
        verdict = { text: 'Strong CUT signal', bgColor: 'bg-green-200', textColor: 'text-green-900', borderColor: 'border-green-400' };
      }
      
      return { ...verdict, score: globalScore.toFixed(2) };

    } catch (e) {
      // This will catch errors if any data object is missing a score
      return { text: 'Error in calculation', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-300', score: 'N/A' };
    }
  };

  const finalVerdict = calculateFinalVerdict();

  return (
    <main className="bg-gray-50 min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            SNB Monetary Policy Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Key indicators influencing Swiss National Bank rate decisions.
          </p>
        </header>

        <div className="mb-8">
          {finalVerdict ? (
            <div className={`border-l-4 ${finalVerdict.borderColor} ${finalVerdict.bgColor} p-4 rounded-r-lg shadow`}>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${finalVerdict.textColor}`}>Overall Outlook</h2>
              <p className={`text-2xl font-bold mt-1 ${finalVerdict.textColor}`}>{finalVerdict.text}</p>
              <p className={`text-sm font-semibold mt-1 ${finalVerdict.textColor}`}>Global Weighted Score: {finalVerdict.score}</p>
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-lg animate-pulse h-24"></div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <IndicatorCard title="1. Inflation" data={allData.inflation} />
          <IndicatorCard title="2. Exchange Rate (EUR/CHF)" data={allData.exchangeRate} />
          <IndicatorCard title="3. Economic Health" data={allData.economicHealth} />
          <IndicatorCard title="4. International Rates" data={allData.internationalRates} />
        </div>
        
        <footer className="text-center mt-12 text-sm text-gray-500">
          <p>For informational purposes only. Not investment advice.</p>
        </footer>
      </div>
    </main>
  );
}