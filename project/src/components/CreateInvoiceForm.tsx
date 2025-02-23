import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit, Tenant, Utility, Deposit } from '../lib/types';

interface CreateInvoiceFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface InvoiceItem {
  type: 'utility' | 'deposit' | 'rent' | 'tax' | 'other';
  description: string;
  amount: number;
  reference_id?: string;
}

interface Tax {
  id: string;
  name: string;
  percentage: number;
}

export function CreateInvoiceForm({ onClose, onSuccess }: CreateInvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<number>(0);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [selectedTaxId, setSelectedTaxId] = useState<string>('');
  const [applyTax, setApplyTax] = useState(false);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchProperties();
    fetchTaxes();
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
      fetchUnitDetails();
    } else {
      setSelectedTenant(null);
      setRentAmount(0);
    }
  }, [selectedUnitId]);

  const fetchTaxes = async () => {
    const { data, error } = await supabase
      .from('taxes')
      .select('*');

    if (error) {
      console.error('Error fetching taxes:', error);
      return;
    }

    setTaxes(data || []);
  };

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

  const fetchUnitDetails = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('units')
      .select('rent_amount')
      .eq('id', selectedUnitId)
      .single();

    if (error) {
      console.error('Error fetching unit details:', error);
      return;
    }

    setRentAmount(data.rent_amount);
    // Add rent as the first invoice item
    setInvoiceItems([{
      type: 'rent',
      description: 'Monthly Rent',
      amount: data.rent_amount
    }]);
  };

  const fetchUtilities = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('utilities')
      .select('*')
      .eq('unit_id', selectedUnitId)
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .eq('status', 'saved');

    if (error) {
      console.error('Error fetching utilities:', error);
      return;
    }

    if (data && data.length > 0) {
      const utilityItems = data.map(utility => ({
        type: 'utility' as const,
        description: `${utility.item.charAt(0).toUpperCase() + utility.item.slice(1)} - ${utility.month}/${utility.year}`,
        amount: utility.amount,
        reference_id: utility.id
      }));

      setInvoiceItems(prev => {
        const nonUtilityItems = prev.filter(item => item.type !== 'utility');
        return [...nonUtilityItems, ...utilityItems];
      });
    }
  };

  const fetchDeposits = async () => {
    if (!selectedUnitId) return;

    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('unit_id', selectedUnitId)
      .eq('status', 'saved');

    if (error) {
      console.error('Error fetching deposits:', error);
      return;
    }

    if (data && data.length > 0) {
      const depositItems = data.map(deposit => ({
        type: 'deposit' as const,
        description: `${deposit.type.charAt(0).toUpperCase() + deposit.type.slice(1)} Deposit`,
        amount: deposit.amount,
        reference_id: deposit.id
      }));

      setInvoiceItems(prev => {
        const nonDepositItems = prev.filter(item => item.type !== 'deposit');
        return [...nonDepositItems, ...depositItems];
      });
    }
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (!applyTax || !selectedTaxId) {
      return { subtotal, taxAmount: 0, total: subtotal };
    }

    const selectedTax = taxes.find(tax => tax.id === selectedTaxId);
    if (!selectedTax) return { subtotal, taxAmount: 0, total: subtotal };

    const taxAmount = (subtotal * selectedTax.percentage) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Validate required fields
      if (!selectedPropertyId || !selectedUnitId || !selectedTenant) {
        alert('Please select property, unit, and ensure there is a tenant');
        return;
      }

      if (invoiceItems.length === 0) {
        alert('Please add at least one item to the invoice');
        return;
      }

      const { subtotal, taxAmount, total } = calculateTotals();

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          owner_id: user.id,
          property_id: selectedPropertyId,
          unit_id: selectedUnitId,
          tenant_id: selectedTenant.id,
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          status: 'draft',
          due_date: dueDate
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItemsData = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        type: item.type,
        description: item.description,
        amount: item.amount,
        reference_id: item.reference_id,
        status: 'active'
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) throw itemsError;

      // Update utilities and deposits status to 'invoiced'
      const utilityIds = invoiceItems
        .filter(item => item.type === 'utility' && item.reference_id)
        .map(item => item.reference_id);

      const depositIds = invoiceItems
        .filter(item => item.type === 'deposit' && item.reference_id)
        .map(item => item.reference_id);

      if (utilityIds.length > 0) {
        await supabase
          .from('utilities')
          .update({ status: 'invoiced' })
          .in('id', utilityIds);
      }

      if (depositIds.length > 0) {
        await supabase
          .from('deposits')
          .update({ status: 'invoiced' })
          .in('id', depositIds);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Create Invoice</h3>
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
              >
                <option value="">Select Unit</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                Due Date *
              </label>
              <input
                type="date"
                name="dueDate"
                id="dueDate"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tenant Display */}
          {selectedTenant && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700">Current Tenant</h4>
              <p className="mt-1 text-sm text-gray-900">
                {selectedTenant.first_name} {selectedTenant.last_name}
              </p>
            </div>
          )}

          {/* Billing Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-700">Billing Items</h4>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={fetchUtilities}
                  disabled={!selectedUnitId}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Utilities
                </button>
                <button
                  type="button"
                  onClick={fetchDeposits}
                  disabled={!selectedUnitId}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deposits
                </button>
              </div>
            </div>

            {/* Invoice Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoiceItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ${item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      Subtotal:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      ${subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {applyTax && selectedTaxId && (
                    <tr>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        Tax ({taxes.find(t => t.id === selectedTaxId)?.percentage}%):
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        ${taxAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      Total:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      ${total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tax Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={applyTax}
                  onChange={(e) => {
                    setApplyTax(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedTaxId('');
                    }
                  }}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">Apply Tax</span>
              </label>
              {applyTax && (
                <select
                  value={selectedTaxId}
                  onChange={(e) => setSelectedTaxId(e.target.value)}
                  className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select Tax</option>
                  {taxes.map(tax => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} ({tax.percentage}%)
                    </option>
                  ))}
                </select>
              )}
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
              disabled={loading || !selectedTenant || invoiceItems.length === 0 || (applyTax && !selectedTaxId)}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}