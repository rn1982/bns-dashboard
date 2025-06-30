// app/components/ManualDataInput.js
import { useState } from 'react';

export default function ManualDataInput({ onUpdate }) {
  const [formData, setFormData] = useState({
    inflation: '',
    snbRate: '',
    saronFutures: '',
    realEstate: '',
    unemployment: '',
    gdp: '',
    exchangeRate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const updateData = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '') {
          updateData[key] = parseFloat(formData[key]);
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('Veuillez remplir au moins un champ');
      }

      const response = await fetch('/api/cron/manual-data-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage('✅ Données mises à jour avec succès');
        setFormData({
          inflation: '',
          snbRate: '',
          saronFutures: '',
          realEstate: '',
          unemployment: '',
          gdp: '',
          exchangeRate: ''
        });
        if (onUpdate) onUpdate();
      } else {
        throw new Error(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      setMessage(`❌ Erreur: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-lg font-semibold mb-4">📝 Mise à jour manuelle des données</h3>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Swiss Inflation (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.inflation}
            onChange={(e) => setFormData(prev => ({...prev, inflation: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., -0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            SNB Policy Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.snbRate}
            onChange={(e) => setFormData(prev => ({...prev, snbRate: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 0.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Swiss GDP Growth (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.gdp}
            onChange={(e) => setFormData(prev => ({...prev, gdp: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 1.25"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Unemployment Rate (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.unemployment}
            onChange={(e) => setFormData(prev => ({...prev, unemployment: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 2.8"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Real Estate Growth (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.realEstate}
            onChange={(e) => setFormData(prev => ({...prev, realEstate: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 3.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            EUR/CHF Exchange Rate
          </label>
          <input
            type="number"
            step="0.0001"
            value={formData.exchangeRate}
            onChange={(e) => setFormData(prev => ({...prev, exchangeRate: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 0.9850"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">
            🎯 SARON Futures 3M (Eurex FSR3 Price)
          </label>
          <input
            type="number"
            step="0.001"
            value={formData.saronFutures}
            onChange={(e) => setFormData(prev => ({...prev, saronFutures: e.target.value}))}
            className="w-full p-2 border rounded"
            placeholder="e.g., 99.750"
          />
          <small className="text-gray-500 mt-1 block">
            📊 Eurex FSR3 futures price. Example: 99.750 = 0.250% implied rate
            <br />
            🔗 Source: <a href="https://www.eurex.com" target="_blank" className="text-blue-600 hover:underline">Eurex.com</a> → Search FSR3
          </small>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Data'}
          </button>
          <p className="mt-2 text-sm text-gray-600">
            💡 Leave fields empty to keep current values. Only enter values you want to change.
          </p>
        </div>
      </form>

      {message && (
        <div className="mt-4 p-3 rounded bg-gray-100">
          {message}
        </div>
      )}
    </div>
  );
}