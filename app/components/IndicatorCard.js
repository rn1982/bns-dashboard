export default function IndicatorCard({ title, data }) {
  if (!data || data.error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-red-600">Error loading data</p>
      </div>
    );
  }

  let displayValue = "No data";
  let displayScore = 0;
  let source = data.source || "Unknown";

  // Handle different indicator types
  if (title.includes("Real Estate")) {
    displayValue = `${data.value}% YoY`;
    displayScore = data.score || 0;
  } else if (title.includes("Inflation")) {
    displayValue = `${data.value}%`;
    displayScore = data.score || 0;
  } else if (title.includes("EUR/CHF")) {
    displayValue = data.value?.toFixed(4) || "N/A";
    displayScore = data.score || 0;
  } else if (title.includes("ECB")) {
    displayValue = `${data.rate}%`;
    displayScore = data.score || 0;
    source = data.source || "FRED (Live)";
  } else if (title.includes("Fed")) {
    displayValue = `${data.rate}%`;
    displayScore = data.score || 0;
    source = data.source || "FRED (Live)";
  } else if (title.includes("GDP")) {
    displayValue = `${data.value}%`;
    displayScore = data.score || 0;
  } else if (title.includes("Unemployment")) {
    displayValue = `${data.value}%`;
    displayScore = data.score || 0;
  }

  // Color coding based on score
  let scoreColor = "text-gray-600";
  let borderColor = "border-gray-400";
  if (displayScore > 0) {
    scoreColor = "text-red-600";
    borderColor = "border-red-400";
  } else if (displayScore < 0) {
    scoreColor = "text-green-600";
    borderColor = "border-green-400";
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${borderColor} hover:shadow-lg transition-shadow`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      
      <div className="mb-3">
        <p className="text-2xl font-bold text-blue-600">{displayValue}</p>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className={`font-semibold ${scoreColor}`}>
          Score: {displayScore}
        </span>
        <span className="text-gray-500 text-xs">
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