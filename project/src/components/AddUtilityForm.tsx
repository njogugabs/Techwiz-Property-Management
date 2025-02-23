import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit, Tenant } from '../lib/types';

interface AddUtilityFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUtilityForm({ onClose, onSuccess }: AddUtilityFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [utilityItem, setUtilityItem] = useState<'water' | 'electricity' | 'garbage' | 'security' | 'cleaning' | 'service' | 'parking'>('water');
  const [previousReading, setPreviousReading] = useState<number | null>(null);
  const [currentReading, setCurrentReading] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [utilityReadings, setUtilityReadings] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchUnits(selectedPropertyId);
    } else {
      setUnits([]);
      setSelectedUnitId('');
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedUnitId) {
      fetchUtilityReadings();
      if (['water', 'electricity'].includes(utilityItem)) {
        fetchPreviousReading();
      }
    }
  }, [selectedUnitId, selectedMonth, selectedYear, utilityItem]);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*');

    if (error) {
      console.error('Error fetching properties:', error);
      return;
    }

    setProperties(data || []);
  };

  const fetchUnits = async (propertyId: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error fetching units:', error);
      return;
    }

    setUnits(data || []);
  };

  const fetchPreviousReading = async () => {
    if (!selectedUnitId || !utilityItem || !['water', 'electricity'].includes(utilityItem)) return;

    const { data, error } = await supabase
      .from('utilities')
      .select('current_reading')
      .eq('unit_id', selectedUnitId)
      .eq('item', utilityItem)
      .lt('month', selectedMonth)
      .order('month', { ascending: false })
      .order('year', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching previous reading:', error);
      return;
    }

    setPreviousReading(data?.[0]?.current_reading || 0);
  };

  const fetchUtilityReadings = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('utilities')
      .select('*')
      .eq('unit_id', selectedUnitId)
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching utility readings:', error);
      return;
    }

    setUtilityReadings(data || []);
    setIsSaved(data?.some(reading => reading.status === 'saved') || false);
    
    const total = data?.reduce((sum, reading) => sum + reading.amount, 0) || 0;
    setTotalAmount(total);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaved) return;

    try {
      // Validate required fields
      if (!selectedPropertyId) {
        alert('Please select a property');
        return;
      }
      if (!selectedUnitId) {
        alert('Please select a unit');
        return;
      }
      if (!utilityItem) {
        alert('Please select a utility type');
        return;
      }
      if (!rate || rate <= 0) {
        alert('Please enter a valid rate');
        return;
      }

      // Check for duplicate utility
      const existingUtility = utilityReadings.find(u => u.item === utilityItem);
      if (existingUtility) {
        alert(`A ${utilityItem} reading already exists for this month.`);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      let consumption = 1; // Default for non-metered utilities
      let amount = rate; // Default amount is just the rate for non-metered utilities

      // For metered utilities (water, electricity)
      if (['water', 'electricity'].includes(utilityItem)) {
        if (!currentReading && currentReading !== 0) {
          alert('Please enter the current reading');
          return;
        }
        consumption = currentReading - (previousReading || 0);
        amount = consumption * rate;
      }

      const utilityData = {
        owner_id: user.id,
        property_id: selectedPropertyId,
        unit_id: selectedUnitId,
        item: utilityItem,
        month: selectedMonth,
        year: selectedYear,
        previous_reading: ['water', 'electricity'].includes(utilityItem) ? previousReading : null,
        current_reading: ['water', 'electricity'].includes(utilityItem) ? currentReading : null,
        consumption,
        rate,
        amount,
        status: 'pending'
      };

      const { error: insertError } = await supabase
        .from('utilities')
        .insert([utilityData]);

      if (insertError) throw insertError;

      await fetchUtilityReadings();
      setCurrentReading(null);
      setRate(null);
    } catch (error) {
      console.error('Error adding utility reading:', error);
      alert('Failed to add utility reading. Please try again.');
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (isSaved) return;

    try {
      const { error } = await supabase
        .from('utilities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchUtilityReadings();
    } catch (error) {
      console.error('Error deleting utility reading:', error);
      alert('Failed to delete utility reading. Please try again.');
    }
  };

  const handleSaveUtilities = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('utilities')
        .update({ status: 'saved' })
        .eq('unit_id', selectedUnitId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .eq('status', 'pending');

      if (error) throw error;
      
      setIsSaved(true);
      await fetchUtilityReadings();
    } catch (error) {
      console.error('Error saving utilities:', error);
      alert('Failed to save utilities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Add Utility Reading</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Property Selection */}
            <div>
              <label htmlFor="propertyId" className="block text-sm font-medium text-gray-700">
                Select Property *
              </label>
              <select
                id="propertyId"
                name="propertyId"
                required
                disabled={isSaved}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <option value="">Select Property</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Selection */}
            <div>
              <label htmlFor="unitId" className="block text-sm font-medium text-gray-700">
                Select Unit *
              </label>
              <select
                id="unitId"
                name="unitId"
                required
                disabled={isSaved}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                <option value="">Select Unit</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selection */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                Month *
              </label>
              <select
                id="month"
                name="month"
                required
                disabled={isSaved}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setPreviousReading(null);
                  setCurrentReading(null);
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selection */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                Year *
              </label>
              <select
                id="year"
                name="year"
                required
                disabled={isSaved}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setPreviousReading(null);
                  setCurrentReading(null);
                }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Utility Type Selection */}
            <div>
              <label htmlFor="utilityItem" className="block text-sm font-medium text-gray-700">
                Utility Item *
              </label>
              <select
                id="utilityItem"
                name="utilityItem"
                required
                disabled={isSaved}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                value={utilityItem}
                onChange={(e) => {
                  const newType = e.target.value as typeof utilityItem;
                  setUtilityItem(newType);
                  setPreviousReading(null);
                  setCurrentReading(null);
                  setRate(null);
                }}
              >
                <option value="">Select Utility</option>
                <option value="water">Water</option>
                <option value="electricity">Electricity</option>
                <option value="garbage">Garbage</option>
                <option value="security">Security</option>
                <option value="cleaning">Cleaning</option>
                <option value="service">Service</option>
                <option value="parking">Parking</option>
              </select>
            </div>

            {/* Readings for metered utilities */}
            {['water', 'electricity'].includes(utilityItem) && (
              <>
                <div>
                  <label htmlFor="previousReading" className="block text-sm font-medium text-gray-700">
                    Previous Reading
                  </label>
                  <input
                    type="number"
                    name="previousReading"
                    id="previousReading"
                    disabled
                    value={previousReading ?? ''}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-100"
                  />
                </div>

                <div>
                  <label htmlFor="currentReading" className="block text-sm font-medium text-gray-700">
                    Current Reading *
                  </label>
                  <input
                    type="number"
                    name="currentReading"
                    id="currentReading"
                    required
                    disabled={isSaved}
                    step="0.01"
                    min={previousReading || 0}
                    value={currentReading ?? ''}
                    onChange={(e) => setCurrentReading(e.target.value ? parseFloat(e.target.value) : null)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </>
            )}

            {/* Rate/Amount Input */}
            <div>
              <label htmlFor="rate" className="block text-sm font-medium text-gray-700">
                {['water', 'electricity'].includes(utilityItem) ? 'Rate per Unit *' : 'Amount *'}
              </label>
              <input
                type="number"
                name="rate"
                id="rate"
                required
                disabled={isSaved}
                step="0.01"
                min="0"
                value={rate ?? ''}
                onChange={(e) => setRate(e.target.value ? parseFloat(e.target.value) : null)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isSaved || !utilityItem}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Reading'}
            </button>
          </div>
        </form>

        {/* Readings Table */}
        {utilityReadings.length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Utility Readings</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Reading</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Reading</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumption</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {utilityReadings.map((reading) => (
                    <tr key={reading.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.item}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.previous_reading}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.current_reading}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.consumption}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.rate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reading.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDeleteReading(reading.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          disabled={isSaved}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Total Amount Row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      Total Amount:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {totalAmount.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleSaveUtilities}
                disabled={loading || isSaved}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Save Readings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}