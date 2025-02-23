import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit, Tenant, Invoice } from '../lib/types';

interface MakePaymentFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface InvoiceWithDetails extends Invoice {
  property: { name: string };
  unit: { name: string };
  tenant: { first_name: string; last_name: string };
}

export function MakePaymentForm({ onClose, onSuccess }: MakePaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'full',
    paymentMode: 'mpesa',
    description: '',
    transactionId: ''
  });

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
    } else {
      setSelectedTenant(null);
      setInvoices([]);
    }
  }, [selectedUnitId]);

  useEffect(() => {
    if (selectedTenant) {
      fetchInvoices();
    } else {
      setInvoices([]);
    }
  }, [selectedTenant]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const isSelected = prev.includes(invoiceId);
      if (isSelected) {
        return prev.filter(id => id !== invoiceId);
      } else {
        return [...prev, invoiceId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Upload file if provided
      let fileUrl = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `payment-receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-files')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
      }

      // Calculate total amount for selected invoices
      const totalInvoiceAmount = selectedInvoices.reduce((sum, invoiceId) => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        return sum + (invoice?.total_amount || 0);
      }, 0);

      // Validate payment amount against selected invoices
      const paymentAmount = parseFloat(formData.amount);
      if (formData.paymentType === 'full' && paymentAmount < totalInvoiceAmount) {
        throw new Error('Full payment amount must cover all selected invoices');
      }

      // Create payments for each selected invoice
      for (const invoiceId of selectedInvoices) {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (!invoice) continue;

        const paymentData = {
          owner_id: user.id,
          property_id: selectedPropertyId,
          unit_id: selectedUnitId,
          tenant_id: selectedTenant?.id,
          invoice_id: invoiceId,
          amount: formData.paymentType === 'full' ? invoice.total_amount : paymentAmount / selectedInvoices.length,
          payment_date: formData.paymentDate,
          payment_type: formData.paymentType,
          payment_mode: formData.paymentMode,
          description: formData.description || null,
          transaction_id: formData.transactionId || null,
          file_url: fileUrl,
          status: 'confirmed'
        };

        const { error: paymentError } = await supabase
          .from('payments')
          .insert([paymentData]);

        if (paymentError) throw paymentError;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error making payment:', error);
      alert('Failed to make payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      alert('Failed to fetch properties. Please try again.');
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      alert('Failed to fetch units. Please try again.');
    }
  };

  const fetchTenant = async () => {
    if (!selectedUnitId) return;

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .single();

      if (error) throw error;
      setSelectedTenant(data);
    } catch (error) {
      console.error('Error fetching tenant:', error);
      alert('Failed to fetch tenant. Please try again.');
    }
  };

  const fetchInvoices = async () => {
    if (!selectedUnitId || !selectedTenant) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          property:properties(name),
          unit:units(name),
          tenant:tenants(first_name, last_name)
        `)
        .eq('tenant_id', selectedTenant.id)
        .in('status', ['sent', 'partially_paid', 'overdue'])
        .order('due_date', { ascending: false });

      if (error) throw error;
      console.log('Fetched invoices:', data); // Debug log
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      alert('Failed to fetch invoices. Please try again.');
    }
  };

  const totalSelectedAmount = selectedInvoices.reduce((sum, invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    return sum + (invoice?.total_amount || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Make Payment</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property and Unit Selection */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="propertyId" className="block text-sm font-medium text-gray-700">
                Select Property *
              </label>
              <select
                id="propertyId"
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

            <div>
              <label htmlFor="unitId" className="block text-sm font-medium text-gray-700">
                Select Unit *
              </label>
              <select
                id="unitId"
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

            {/* Tenant Display */}
            {selectedTenant && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tenant
                </label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedTenant.first_name} {selectedTenant.last_name}
                </div>
              </div>
            )}
          </div>

          {/* Invoices Table */}
          {invoices.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Outstanding Invoices</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Select
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Number
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={() => handleInvoiceSelection(invoice.id)}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${invoice.total_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : invoice.status === 'partially_paid'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {invoice.status.replace('_', ' ').charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {selectedInvoices.length > 0 && (
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={3} className="px-6 py-4 text-right text-sm text-gray-900">
                          Total Selected Amount:
                        </td>
                        <td colSpan={2} className="px-6 py-4 text-left text-sm text-gray-900">
                          ${totalSelectedAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">
                Payment Date *
              </label>
              <input
                type="date"
                name="paymentDate"
                id="paymentDate"
                required
                value={formData.paymentDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

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
                value={formData.amount}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {selectedInvoices.length > 0 && formData.paymentType === 'full' && parseFloat(formData.amount) < totalSelectedAmount && (
                <p className="mt-1 text-sm text-red-600">
                  Full payment amount must be at least ${totalSelectedAmount.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="paymentType" className="block text-sm font-medium text-gray-700">
                Payment Type *
              </label>
              <select
                id="paymentType"
                name="paymentType"
                required
                value={formData.paymentType}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="full">Full Payment</option>
                <option value="partial">Partial Payment</option>
              </select>
            </div>

            <div>
              <label htmlFor="paymentMode" className="block text-sm font-medium text-gray-700">
                Payment Mode *
              </label>
              <select
                id="paymentMode"
                name="paymentMode"
                required
                value={formData.paymentMode}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="mpesa">M-PESA</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label htmlFor="transactionId" className="block text-sm font-medium text-gray-700">
                Transaction ID
              </label>
              <input
                type="text"
                name="transactionId"
                id="transactionId"
                value={formData.transactionId}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                name="description"
                id="description"
                value={formData.description}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Upload Receipt
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PDF, PNG, JPG up to 10MB
                </p>
              </div>
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
              disabled={loading || !selectedTenant || selectedInvoices.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Make Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}