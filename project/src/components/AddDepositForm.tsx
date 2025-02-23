import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit, Tenant, Deposit, DepositType } from '../lib/types';
import { DEPOSIT_TYPES } from '../lib/types';

interface AddDepositFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDepositForm({ onClose, onSuccess }: AddDepositFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [depositType, setDepositType] = useState<DepositType | ''>('');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchUnits(selectedPropertyId);
    } else {
      setUnits([]);
      setSelectedUnitId('');
      setSelectedTenant(null);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedUnitId) {
      fetchTenant();
      fetchDeposits();
    } else {
      setSelectedTenant(null);
    }
  }, [selectedUnitId]);

  useEffect(() => {
    const total = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    setTotalAmount(total);
  }, [deposits]);

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

  const fetchTenant = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('unit_id', selectedUnitId)
      .single();

    if (error) {
      console.error('Error fetching tenant:', error);
      return;
    }

    setSelectedTenant(data);
  };

  const fetchDeposits = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('deposits')
      .select(`
        *,
        properties(name),
        units(name),
        tenants(first_name, last_name)
      `)
      .eq('unit_id', selectedUnitId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deposits:', error);
      return;
    }

    setDeposits(data || []);
    setIsSaved(data?.some(deposit => deposit.status === 'saved') || false);
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
      if (!depositType) {
        alert('Please select a deposit type');
        return;
      }
      if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }
      if (!date) {
        alert('Please select a date');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');
      if (!selectedTenant) throw new Error('No tenant found for this unit');

      // Check if deposit type already exists
      const existingDeposit = deposits.find(d => d.type === depositType);
      if (existingDeposit) {
        alert(`A ${depositType} deposit already exists for this unit.`);
        return;
      }

      const depositData = {
        owner_id: user.id,
        property_id: selectedPropertyId,
        unit_id: selectedUnitId,
        tenant_id: selectedTenant.id,
        type: depositType,
        amount,
        date,
        status: 'pending'
      };

      const { error: insertError } = await supabase
        .from('deposits')
        .insert([depositData]);

      if (insertError) throw insertError;

      await fetchDeposits();
      setDepositType('');
      setAmount(null);
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error adding deposit:', error);
      alert('Failed to add deposit. Please try again.');
    }
  };

  const handleDeleteDeposit = async (id: string) => {
    if (isSaved) return;

    try {
      const { error } = await supabase
        .from('deposits')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchDeposits();
    } catch (error) {
      console.error('Error deleting deposit:', error);
      alert('Failed to delete deposit. Please try again.');
    }
  };

  const handleSaveDeposits = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'saved' })
        .eq('unit_id', selectedUnitId)
        .eq('status', 'pending');

      if (error) throw error;
      
      setIsSaved(true);
      await fetchDeposits();
    } catch (error) {
      console.error('Error saving deposits:', error);
      alert('Failed to save deposits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    try {
      // Here you would implement the logic to create an invoice
      alert('Creating invoice with total amount: ' + totalAmount.toFixed(2));
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    }
  };

  // Get available deposit types (exclude ones already used)
  const availableDepositTypes = DEPOSIT_TYPES.filter(
    type => !deposits.some(d => d.type === type)
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Add Deposit</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                disabled={isSaved}
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={isSaved}
              >
                <option value="">Select Unit</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tenant Display */}
            {selectedTenant && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Current Tenant
                </label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedTenant.first_name} {selectedTenant.last_name}
                </div>
              </div>
            )}

            {/* Deposit Type */}
            <div>
              <label htmlFor="depositType" className="block text-sm font-medium text-gray-700">
                Deposit Type *
              </label>
              <select
                id="depositType"
                name="depositType"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as DepositType)}
                disabled={isSaved || availableDepositTypes.length === 0}
              >
                <option value="">Select Deposit Type</option>
                {availableDepositTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)} Deposit
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount *
              </label>
              <input
                type="number"
                name="amount"
                id="amount"
                required
                step="0.01"
                min="0"
                value={amount ?? ''}
                onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : null)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={isSaved}
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <input
                type="date"
                name="date"
                id="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={isSaved}
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
              disabled={loading || !selectedTenant || isSaved || availableDepositTypes.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Deposit'}
            </button>
          </div>
        </form>

        {/* Deposits Table */}
        {deposits.length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Deposits</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deposits.map((deposit) => (
                    <tr key={deposit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{deposit.properties.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{deposit.units.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {`${deposit.tenants.first_name} ${deposit.tenants.last_name}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {deposit.type.charAt(0).toUpperCase() + deposit.type.slice(1)} Deposit
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{deposit.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(deposit.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDeleteDeposit(deposit.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={isSaved}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Total Amount Row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      Total Amount:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {totalAmount.toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleSaveDeposits}
                disabled={loading || isSaved}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Save Deposits
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={loading || !isSaved}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Create Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}