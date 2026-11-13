'use client';
// Small line chart of one indicator's history, read from /api/history.
// Manual entries are drawn as orange dots so they stand out from live data.
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const LINE = '#2563eb';
const MANUAL = '#d97706';

// Range buttons shown above the cards. `years: null` = everything (since 2000).
export const RANGES = [
  { id: '1y', label: '1Y', years: 1 },
  { id: '5y', label: '5Y', years: 5 },
  { id: '10y', label: '10Y', years: 10 },
  { id: 'max', label: 'Since 2000', years: null },
];

export function rangeStart(rangeId, now = new Date()) {
  const r = RANGES.find(x => x.id === rangeId) || RANGES[1];
  if (!r.years) return '2000-01-01';
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - r.years);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = d => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`; // 'Oct 26'
const longDate = d => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

// stepped: draw as steps (for policy rates, which jump at meetings). tall: bigger chart for wide cards.
export default function HistoryChart({ indicator, from, format = v => String(v), stepped = false, tall = false }) {
  const h = tall ? 'h-44' : 'h-28';
  const [state, setState] = useState({ loading: true, points: [], error: null });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    fetch(`/api/history?indicator=${indicator}&from=${from}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(body => {
        if (cancelled) return;
        if (body.error) setState({ loading: false, points: [], error: body.error });
        else setState({ loading: false, points: body.points || [], error: null });
      })
      .catch(e => !cancelled && setState({ loading: false, points: [], error: e.message }));
    return () => { cancelled = true; };
  }, [indicator, from]);

  if (state.loading && !state.points.length) {
    return <div className={`${h} rounded bg-gray-50 animate-pulse`} />;
  }
  if (state.error) {
    return <p className={`${h} flex items-center justify-center text-xs text-gray-400`}>History unavailable: {state.error}</p>;
  }
  if (state.points.length < 2) {
    return (
      <p className={`${h} flex items-center justify-center text-center text-xs text-gray-400 px-4`}>
        No history in this range yet. It builds up from each value you save.
      </p>
    );
  }

  const pts = state.points;
  const isManual = pts.map(p => p.origin === 'manual');
  const data = {
    labels: pts.map(p => p.date),
    datasets: [{
      data: pts.map(p => p.value),
      borderColor: LINE,
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      fill: true,
      borderWidth: 1.5,
      tension: stepped ? 0 : 0.2,
      stepped: stepped ? 'after' : false,
      pointRadius: isManual.map(m => (m ? 3 : 0)),
      pointBackgroundColor: isManual.map(m => (m ? MANUAL : LINE)),
      pointBorderColor: isManual.map(m => (m ? MANUAL : LINE)),
      pointHoverRadius: 4,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: items => longDate(pts[items[0].dataIndex].date),
          label: item => `${format(item.parsed.y)}${isManual[item.dataIndex] ? ' (manual)' : ''}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxTicksLimit: tall ? 8 : 4,
          maxRotation: 0,
          font: { size: 10 },
          color: '#9ca3af',
          callback: (_, i) => shortDate(pts[i].date),
        },
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { maxTicksLimit: 4, font: { size: 10 }, color: '#9ca3af' },
      },
    },
  };

  return (
    <div className={`${h} ${state.loading ? 'opacity-50' : ''}`}>
      <Line data={data} options={options} />
    </div>
  );
}
