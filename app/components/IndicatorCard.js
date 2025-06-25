'use client';

import MiniChart from './MiniChart';

// A simple function to get the right arrow and colors based on the trend
const getTrendVisuals = (trend) => {
  switch (trend) {
    case 'up':
      return { icon: '↑', color: 'text-red-500', bgColor: 'bg-red-100' };
    case 'down':
      return { icon: '↓', color: 'text-green-500', bgColor: 'bg-green-100' };
    default:
      return { icon: '→', color: 'text-gray-500', bgColor: 'bg-gray-100' };
  }
};

export default function IndicatorCard({ title, data }) {
  if (!data) {
    // Show loading state
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-12 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-full mt-4"></div>
      </div>
    );
  }

  // Check card type by looking at unique properties in the data object
  const isEconomicHealthCard = !!data.gdp;
  const isInternationalCard = !!data.ecb;

  const historicalData = data.historicalData || (data.gdp && data.gdp.historicalData);
  const { source, nextPublication, trend, trendText } = data;
  const { icon, color, bgColor } = getTrendVisuals(trend);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex flex-col h-full">
      <h2 className="text-lg sm:text-xl font-bold text-gray-700">{title}</h2>

      <div className="flex-grow my-4">
        {/* Conditional rendering for the main value(s) */}
        {isInternationalCard ? (
          <>
            <p className="text-3xl font-bold text-gray-900">ECB: {data.ecb.value?.toFixed(2)}%</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">Fed: {data.fed.value?.toFixed(2)}%</p>
          </>
        ) : (
          <p className="text-4xl sm:text-5xl font-bold text-gray-900">
            {(isEconomicHealthCard ? data.gdp.value : data.value)?.toFixed(1)}%
          </p>
        )}

        {isEconomicHealthCard && (
          <p className="text-lg text-gray-600 mt-1">
            Unemployment: {data.unemployment.value?.toFixed(1)}%
          </p>
        )}

        <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${bgColor} ${color}`}>
          <span className="mr-1.5 text-lg">{icon}</span>
          {trendText}
        </div>
      </div>

      <div className="h-24 mb-4">
        {/* Only show the chart if there is historical data */}
        {historicalData && historicalData.length > 0 ? (
          <MiniChart data={historicalData} trend={trend} />
        ) : (
          <div className="h-full bg-gray-50 rounded-md flex items-center justify-center">
            <p className="text-sm text-gray-400">No chart for this indicator</p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 border-t pt-2">
        <p><strong>Source:</strong> {source}</p>
        <p><strong>Next:</strong> {nextPublication}</p>
      </div>
    </div>
  );
}