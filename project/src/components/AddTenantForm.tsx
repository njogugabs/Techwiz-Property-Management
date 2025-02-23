import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Property, Unit } from '../lib/types';

interface AddTenantFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTenantForm({ onClose, onSuccess }: AddTenantFormProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [penaltyType, setPenaltyType] = useState<'fixed' | 'percentage'>('fixed');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchUnits(selectedPropertyId);
    } else {
      setUnits([]);
    }
  }, [selectedPropertyId]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Format dates properly - if empty string, set to null
      const moveInDate = formData.get('moveInDate') as string;
      const moveOutDate = formData.get('moveOutDate') as string;
      const leaseStartDate = formData.get('leaseStartDate') as string;
      const leaseExpiryDate = formData.get('leaseExpiryDate') as string;

      const tenantData = {
        owner_id: user.id,
        property_id: formData.get('propertyId'),
        unit_id: formData.get('unitId'),
        first_name: formData.get('firstName'),
        last_name: formData.get('lastName'),
        phone: formData.get('phone'),
        deposit_amount: formData.get('depositAmount') ? parseFloat(formData.get('depositAmount') as string) : null,
        deposit_type: formData.get('depositType') || null,
        amount_paid: formData.get('amountPaid') ? parseFloat(formData.get('amountPaid') as string) : null,
        amount_returned: formData.get('amountReturned') ? parseFloat(formData.get('amountReturned') as string) : null,
        account_number: formData.get('accountNumber') || null,
        national_id: formData.get('nationalId') || null,
        email: formData.get('email') || null,
        kra_pin: formData.get('kraPin') || null,
        penalty_type: penaltyType,
        penalty_amount: formData.get('penaltyAmount') ? parseFloat(formData.get('penaltyAmount') as string) : null,
        notes: formData.get('notes') || null,
        move_in_date: moveInDate || null,
        move_out_date: moveOutDate || null,
        other_phones: formData.get('otherPhones') || null,
        bank_payer_names: formData.get('bankPayerNames') || null,
        lease_start_date: leaseStartDate || null,
        lease_expiry_date: leaseExpiryDate || null
      };

      // Insert tenant data
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert([tenantData])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${tenant.id}-${Math.random()}.${fileExt}`;
        const filePath = `tenant-documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('tenant-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding tenant:', error);
      alert('Failed to add tenant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Add New Tenant</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            {!properties.length && (
              <p className="mt-1 text-sm text-gray-500">
                If the property is not available in the list, please go to the properties page to add it.
              </p>
            )}
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
            >
              <option value="">Select Unit</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {!units.length && selectedPropertyId && (
              <p className="mt-1 text-sm text-gray-500">
                If the unit is not available in the list, please go to the units page to add it.
              </p>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                id="firstName"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                id="lastName"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                id="phone"
                required
                placeholder="+254700000000"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                The phone number should be in international format: country code then phone number.
              </p>
            </div>
          </div>

          {/* Deposit Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Deposit Information</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label htmlFor="depositType" className="block text-sm font-medium text-gray-700">
                  Deposit Type
                </label>
                <select
                  id="depositType"
                  name="depositType"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="rent">Rent Deposit</option>
                  <option value="security">Security Deposit</option>
                  <option value="utility">Utility Deposit</option>
                </select>
              </div>

              <div>
                <label htmlFor="depositAmount" className="block text-sm font-medium text-gray-700">
                  Amount Paid
                </label>
                <input
                  type="number"
                  name="depositAmount"
                  id="depositAmount"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="amountReturned" className="block text-sm font-medium text-gray-700">
                  Amount Returned
                </label>
                <input
                  type="number"
                  name="amountReturned"
                  id="amountReturned"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
                Account Number
              </label>
              <input
                type="text"
                name="accountNumber"
                id="accountNumber"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Used when reconciling payments.
              </p>
            </div>

            <div>
              <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700">
                National ID
              </label>
              <input
                type="text"
                name="nationalId"
                id="nationalId"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="kraPin" className="block text-sm font-medium text-gray-700">
                KRA/Tax Pin
              </label>
              <input
                type="text"
                name="kraPin"
                id="kraPin"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Penalty Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Rent Payment Penalty</h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Penalty Type</label>
                <select
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value as 'fixed' | 'percentage')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage of Rent</option>
                </select>
              </div>

              <div>
                <label htmlFor="penaltyAmount" className="block text-sm font-medium text-gray-700">
                  {penaltyType === 'fixed' ? 'Amount' : 'Percentage'}
                </label>
                <input
                  type="number"
                  name="penaltyAmount"
                  id="penaltyAmount"
                  step={penaltyType === 'fixed' ? '0.01' : '0.1'}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="moveInDate" className="block text-sm font-medium text-gray-700">
                Move In Date
              </label>
              <input
                type="date"
                name="moveInDate"
                id="moveInDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="moveOutDate" className="block text-sm font-medium text-gray-700">
                Move Out Date
              </label>
              <input
                type="date"
                name="moveOutDate"
                id="moveOutDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="leaseStartDate" className="block text-sm font-medium text-gray-700">
                Lease Start Date
              </label>
              <input
                type="date"
                name="leaseStartDate"
                id="leaseStartDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="leaseExpiryDate" className="block text-sm font-medium text-gray-700">
                Lease Expiry Date
              </label>
              <input
                type="date"
                name="leaseExpiryDate"
                id="leaseExpiryDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Additional Contact Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="otherPhones" className="block text-sm font-medium text-gray-700">
                Other phone numbers
              </label>
              <input
                type="text"
                name="otherPhones"
                id="otherPhones"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="+254700000000, +254711111111"
              />
              <p className="mt-1 text-sm text-gray-500">
                First name and phone number are used when reconciling payments.
                The phone numbers should be in international format: country code then phone number.
              </p>
            </div>

            <div>
              <label htmlFor="bankPayerNames" className="block text-sm font-medium text-gray-700">
                Bank Payer Names
              </label>
              <input
                type="text"
                name="bankPayerNames"
                id="bankPayerNames"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              name="notes"
              id="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              File upload
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
                      name="file"
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  File can be lease agreement, or any other tenant document
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
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}