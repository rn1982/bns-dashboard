'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js';

// We need to register the components we are using from Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip
);

export default function MiniChart({ data = [], trend }) {
  // Set the line color based on the overall trend for a nice visual touch
  const trendColor = trend === 'up' ? '#EF4444' : trend === 'down' ? '#22C55E' : '#6B7280';

  const chartData = {
    labels: data.map(d => d.date), // Labels for the x-axis (e.g., '2024-06')
    datasets: [
      {
        data: data.map(d => d.value), // The actual data points for the y-axis
        borderColor: trendColor,
        tension: 0.4, // This makes the line smooth and curved
        pointRadius: 0, // We don't want to show dots for each data point
      },
    ],
  };

  const chartOptions = {
    responsive: true, // Make the chart adapt to its container size
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide the legend
      },
      tooltip: {
        enabled: true, // Show tooltips on hover
      },
    },
    scales: {
      x: {
        display: false, // Hide the x-axis labels
      },
      y: {
        display: false, // Hide the y-axis labels
      },
    },
  };

  return <Line options={chartOptions} data={chartData} />;
}