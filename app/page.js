'use client';

import { useState, useEffect } from 'react';
import IndicatorCard from './components/IndicatorCard';

const WEIGHTS = {
  inflation: 0.35, 
  exchangeRate: 0.25, 
  ecb: 0.15,
  gdp: 0.10, 
  fed: 0.10, 
  unemployment: 0.05,
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
        const [inflationRes, exchangeRateRes, economicHealthRes, internationalRatesRes] = await Promise.all([
          fetch('/api/inflation').then(res => res.json()),
          fetch('/api/exchange-rate').then(res => res.json()),
          fetch('/api/economic-health').then(res => res.json()),
          fetch('/api/international-rates').then(res => res.json())
        ]);
        
        setAllData({
          inflation: inflationRes,
          exchangeRate: exchangeRateRes,
          economicHealth: economicHealthRes,
          internationalRates: internationalRatesRes,
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
      const exchangeRateScore = allData.exchangeRate?.score || 0;
      const gdpScore = allData.economicHealth?.gdp?.score || 0;
      const unemploymentScore = allData.economicHealth?.unemployment?.score || 0;
      const ecbScore = allData.internationalRates?.ecb?.score || 0;
      const fedScore = allData.internationalRates?.fed?.score || 0;
      
      const globalScore = 
        (inflationScore * WEIGHTS.inflation) +
        (exchangeRateScore * WEIGHTS.exchangeRate) +
        (gdpScore * WEIGHTS.gdp) +
        (unemploymentScore * WEIGHTS.unemployment) +
        (ecbScore * WEIGHTS.ecb) +
        (fedScore * WEIGHTS.fed);
      
      let verdict = {};
      if (globalScore >= 0.7) {
        verdict = { 
          text: 'Strong HIKE signal', 
          bgColor: 'bg-red-200', 
          textColor: 'text-red-900', 
          borderColor: 'border-red-400' 
        };
      } else if (globalScore >= 0.2) {
        verdict = { 
          text: 'Moderate HIKE signal', 
          bgColor: 'bg-red-100', 
          textColor: 'text-red-800', 
          borderColor: 'border-red-300' 
        };
      } else if (globalScore > -0.2) {
        verdict = { 
          text: 'Rates likely STABLE', 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-800', 
          borderColor: 'border-gray-300' 
        };
      } else if (globalScore > -0.7) {
        verdict = { 
          text: 'Moderate CUT signal', 
          bgColor: 'bg-green-100', 
          textColor: 'text-green-800', 
          borderColor: 'border-green-300' 
        };
      } else {
        verdict = { 
          text: 'Strong CUT signal', 
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
            Key indicators influencing Swiss National Bank rate decisions.
          </p>
        </header>

        <div className="mb-8">
          {finalVerdict ? (
            <div className={`border-l-4 ${finalVerdict.borderColor} ${finalVerdict.bgColor} p-4 rounded-r-lg shadow`}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${finalVerdict.textColor}`}>
                    Overall Outlook
                  </h2>
                  <p className={`text-2xl font-bold mt-1 ${finalVerdict.textColor}`}>
                    {finalVerdict.text}
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
              <p className={`text-sm font-semibold mt-2 ${finalVerdict.textColor}`}>
                Global Weighted Score: {finalVerdict.score}
              </p>
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-lg animate-pulse h-24 flex items-center justify-center">
              <span className="text-gray-600">
                {isLoading ? "Loading data..." : "Calculating outlook..."}
              </span>
            </div>
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