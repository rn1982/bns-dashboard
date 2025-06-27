export default function IndicatorCard({ title, data }) {
  console.log(`IndicatorCard: ${title}`, data);

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-red-600">Error: {data.error}</p>
      </div>
    );
  }

  // Format display value and score based on card type
  let displayValue = "No data";
  let displayScore = 0;
  let source = data.source || "Unknown";

  try {
    if (title.includes("Inflation")) {
      displayValue = `${data.value}%`;
      displayScore = data.score || 0;
    } 
    else if (title.includes("Exchange Rate")) {
      displayValue = data.value?.toFixed(4) || "N/A";
      displayScore = data.score || 0;
    }
    else if (title.includes("Economic Health")) {
      if (data.gdp && data.unemployment) {
        displayValue = `GDP: ${data.gdp.value}%, Unemployment: ${data.unemployment.value}%`;
        displayScore = (data.gdp.score || 0) + (data.unemployment.score || 0);
        source = data.gdp.source || "Multiple sources";
      }
    }
    else if (title.includes("International Rates")) {
      if (data.ecb && data.fed) {
        displayValue = `ECB: ${data.ecb.rate}%, Fed: ${data.fed.rate}%`;
        displayScore = (data.ecb.score || 0) + (data.fed.score || 0);
        source = data.ecb.source || "Multiple sources";
      }
    }
  } catch (error) {
    console.error(`Error processing ${title}:`, error);
    displayValue = "Error processing data";
  }

  // Color coding based on score
  let scoreColor = "text-gray-600";
  if (displayScore > 0) scoreColor = "text-red-600";
  else if (displayScore < 0) scoreColor = "text-green-600";

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      
      <div className="mb-3">
        <p className="text-2xl font-bold text-blue-600">{displayValue}</p>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className={`font-semibold ${scoreColor}`}>
          Score: {displayScore}
        </span>
        <span className="text-gray-500">
          {source}
        </span>
      </div>
      
      {data.updatedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Updated: {new Date(data.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}