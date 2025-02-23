import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit } from '../lib/types';

interface AddUnitFormProps {
  propertyId?: string;
  unit?: Unit;
  onClose: () => void;
  onSuccess: () => void;
}

interface BillRow {
  id: string;
  item: string;
  month: number;
  year: number;
  rate: number;
  previousReading?: number;
  currentReading?: number;
  consumption: number;
  amount: number;
}

export function AddUnitForm({ propertyId: propId, unit, onClose, onSuccess }: AddUnitFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(propId || unit?.property_id || '');

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*');

    if (error) {
      console.error('Error fetching properties:', error);
      return;
    }

    setProperties(properties || []);
  };

  const addBillRow = () => {
    const newRow: BillRow = {
      id: crypto.randomUUID(),
      item: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      rate: 0,
      consumption: 0,
      amount: 0
    };
    setBills([...bills, newRow]);
  };

  const removeBillRow = (id: string) => {
    setBills(bills.filter(bill => bill.id !== id));
  };

  const updateBillRow = (id: string, updates: Partial<BillRow>) => {
    setBills(bills.map(bill => {
      if (bill.id === id) {
        const updatedBill = { ...bill, ...updates };
        
        // Calculate consumption for water and electricity
        if (['water', 'electricity'].includes(updatedBill.item) && 
            updatedBill.currentReading !== undefined && 
            updatedBill.previousReading !== undefined) {
          updatedBill.consumption = updatedBill.currentReading - updatedBill.previousReading;
        }
        
        // Calculate amount
        updatedBill.amount = updatedBill.consumption * updatedBill.rate;
        
        return updatedBill;
      }
      return bill;
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const unitData = {
      property_id: selectedPropertyId || formData.get('propertyId'),
      name: formData.get('unitName'),
      rent_amount: parseFloat(formData.get('rentAmount') as string),
      is_occupied: formData.get('isOccupied') === 'on',
      tax_rate: formData.get('taxRate') ? parseFloat(formData.get('taxRate') as string) : null,
      notes: formData.get('notes')
    };

    try {
      if (unit) {
        // Update existing unit
        const { error: updateError } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', unit.id);

        if (updateError) throw updateError;
      } else {
        // Insert new unit
        const { data: newUnit, error: insertError } = await supabase
          .from('units')
          .insert([unitData])
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert bills if any
        if (bills.length > 0) {
          const billsData = bills.map(bill => ({
            unit_id: newUnit.id,
            ...bill
          }));

          const { error: billsError } = await supabase
            .from('unit_bills')
            .insert(billsData);

          if (billsError) throw billsError;
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving unit:', error);
      alert('Failed to save unit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {unit ? 'Edit Unit' : 'Add New Unit'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="propertyId" className="block text-sm font-medium text-gray-700">
                Select Property *
              </label>
              <select
                id="propertyId"
                name="propertyId"
                required
                disabled={!!propId}
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select a property</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="unitName" className="block text-sm font-medium text-gray-700">
                Unit ID/Name *
              </label>
              <input
                type="text"
                name="unitName"
                id="unitName"
                required
                defaultValue={unit?.name}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="rentAmount" className="block text-sm font-medium text-gray-700">
                Rent Amount *
              </label>
              <input
                type="number"
                name="rentAmount"
                id="rentAmount"
                required
                min="0"
                step="0.01"
                defaultValue={unit?.rent_amount}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="isOccupied"
                  defaultChecked={unit?.is_occupied}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="ml-2">Unit is currently occupied</span>
              </label>
            </div>

            <div>
              <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">
                Tax Rate % (optional)
              </label>
              <input
                type="number"
                name="taxRate"
                id="taxRate"
                step="0.01"
                min="0"
                max="100"
                defaultValue={unit?.tax_rate}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Residential units tax rate is usually 7.5%. Commercial units tax rate is usually 16%.
              </p>
            </div>
          </div>

          {/* Recurring Bills - Only show for new units */}
          {!unit && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  Other Recurring Bills
                </label>
                <button
                  type="button"
                  onClick={addBillRow}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Bill
                </button>
              </div>

              {bills.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Reading</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Reading</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumption</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bills.map(bill => (
                        <tr key={bill.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={bill.item}
                              onChange={(e) => updateBillRow(bill.id, { item: e.target.value })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              <option value="">Select item</option>
                              {['water', 'electricity', 'garbage', 'security', 'cleaning', 'service', 'parking'].map(item => (
                                <option key={item} value={item}>
                                  {item.charAt(0).toUpperCase() + item.slice(1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={bill.month}
                              onChange={(e) => updateBillRow(bill.id, { month: parseInt(e.target.value) })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              min="2000"
                              value={bill.year}
                              onChange={(e) => updateBillRow(bill.id, { year: parseInt(e.target.value) })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bill.rate}
                              onChange={(e) => updateBillRow(bill.id, { rate: parseFloat(e.target.value) })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {['water', 'electricity'].includes(bill.item) && (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={bill.previousReading}
                                onChange={(e) => updateBillRow(bill.id, { previousReading: parseFloat(e.target.value) })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {['water', 'electricity'].includes(bill.item) && (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={bill.currentReading}
                                onChange={(e) => updateBillRow(bill.id, { currentReading: parseFloat(e.target.value) })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bill.consumption}
                              onChange={(e) => updateBillRow(bill.id, { consumption: parseFloat(e.target.value) })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {bill.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => removeBillRow(bill.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              id="notes"
              rows={3}
              defaultValue={unit?.notes}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter any additional notes"
            />
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
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (unit ? 'Saving...' : 'Adding...') : (unit ? 'Save Changes' : 'Add Unit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}