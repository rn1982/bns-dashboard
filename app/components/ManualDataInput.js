'use client';

import { useState } from 'react';

export default function ManualDataInput() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    inflation: '',
    snbRate: '',
    gdp: '',
    unemployment: '',
    realEstate: ''
  });
  const [lastUpdate, setLastUpdate] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Filter out empty values
      const dataToUpdate = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '') {
          dataToUpdate[key] = parseFloat(formData[key]);
        }
      });

      if (Object.keys(dataToUpdate).length === 0) {
        alert('Please enter at least one value to update');
        setIsLoading(false);
        return;
      }

      console.log('Sending update:', dataToUpdate);

      const response = await fetch('/api/cron/manual-data-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToUpdate)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Response result:', result);

      if (result.success) {
        setLastUpdate(new Date().toLocaleString());
        setFormData({
          inflation: '',
          snbRate: '',
          gdp: '',
          unemployment: '',
          realEstate: ''
        });
        alert('✅ Data updated successfully! Refresh the page to see changes.');
      } else {
        alert(`❌ Update failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert(`❌ Update failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          📝 Manual Data Update
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-blue-900">Manual Data Update</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-blue-600 hover:text-blue-800"
        >
          ✕ Close
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">
              Swiss Inflation (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.inflation}
              onChange={(e) => setFormData({...formData, inflation: e.target.value})}
              placeholder="e.g., -0.1"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-blue-600 mt-1">Current: -0.1% (May 2025)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">
              SNB Policy Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.snbRate}
              onChange={(e) => setFormData({...formData, snbRate: e.target.value})}
              placeholder="e.g., 0.0"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-blue-600 mt-1">Current: 0.0% (June 2025)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">
              Swiss GDP Growth (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.gdp}
              onChange={(e) => setFormData({...formData, gdp: e.target.value})}
              placeholder="e.g., 1.25"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-blue-600 mt-1">Current: 1.25%</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">
              Unemployment Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.unemployment}
              onChange={(e) => setFormData({...formData, unemployment: e.target.value})}
              placeholder="e.g., 2.8"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-blue-600 mt-1">Current: 2.8%</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">
              Real Estate Growth (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.realEstate}
              onChange={(e) => setFormData({...formData, realEstate: e.target.value})}
              placeholder="e.g., 3.5"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-blue-600 mt-1">Current: 3.5%</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {isLoading ? 'Updating...' : 'Update Data'}
          </button>
          
          {lastUpdate && (
            <span className="text-sm text-green-600">
              Last manual update: {lastUpdate}
            </span>
          )}
        </div>

        <p className="text-xs text-blue-600">
          💡 Leave fields empty to keep current values. Only enter values you want to change.
        </p>
      </form>
    </div>
  );
}