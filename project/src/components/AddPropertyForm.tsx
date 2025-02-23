import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RECURRING_BILLS, type RecurringBill, type Property } from '../lib/types';

interface AddPropertyFormProps {
  property?: Property;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPropertyForm({ property, onClose, onSuccess }: AddPropertyFormProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'paybill' | 'till'>(property?.payment_method || 'paybill');
  const [penaltyType, setPenaltyType] = useState<'fixed' | 'percentage_rent' | 'percentage_balance'>(property?.penalty_type || 'fixed');
  const [managementFeeType, setManagementFeeType] = useState<'fixed' | 'percentage'>(property?.management_fee_type || 'fixed');
  const [selectedBills, setSelectedBills] = useState<RecurringBill[]>(property?.recurring_bills || []);
  const [autoPenalize, setAutoPenalize] = useState(property?.auto_penalize || false);

  const handleBillToggle = (bill: RecurringBill) => {
    setSelectedBills(prev => 
      prev.includes(bill)
        ? prev.filter(b => b !== bill)
        : [...prev, bill]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      // Get all form elements
      const form = e.target as HTMLFormElement;
      const propertyName = form.querySelector<HTMLInputElement>('[name="propertyName"]')?.value;
      const units = form.querySelector<HTMLInputElement>('[name="units"]')?.value;
      const city = form.querySelector<HTMLInputElement>('[name="city"]')?.value;
      const waterRate = form.querySelector<HTMLInputElement>('[name="waterRate"]')?.value;
      const electricityRate = form.querySelector<HTMLInputElement>('[name="electricityRate"]')?.value;
      const paymentNumber = form.querySelector<HTMLInputElement>('[name="paymentNumber"]')?.value;
      const penaltyAmount = form.querySelector<HTMLInputElement>('[name="penaltyAmount"]')?.value;
      const taxRate = form.querySelector<HTMLInputElement>('[name="taxRate"]')?.value;
      const managementFeeAmount = form.querySelector<HTMLInputElement>('[name="managementFeeAmount"]')?.value;
      const streetName = form.querySelector<HTMLInputElement>('[name="streetName"]')?.value;
      const companyName = form.querySelector<HTMLInputElement>('[name="companyName"]')?.value;
      const notes = form.querySelector<HTMLTextAreaElement>('[name="notes"]')?.value;
      const paymentInstructions = form.querySelector<HTMLTextAreaElement>('[name="paymentInstructions"]')?.value;

      if (!propertyName || !units || !city) {
        throw new Error('Required fields are missing');
      }

      const propertyData = {
        owner_id: user.id,
        name: propertyName,
        units: parseInt(units, 10),
        city: city,
        water_rate: waterRate ? parseFloat(waterRate) : null,
        electricity_rate: electricityRate ? parseFloat(electricityRate) : null,
        payment_method: paymentMethod,
        payment_number: paymentNumber || null,
        penalty_type: penaltyType,
        penalty_amount: penaltyAmount ? parseFloat(penaltyAmount) : null,
        auto_penalize: autoPenalize,
        tax_rate: taxRate ? parseFloat(taxRate) : null,
        recurring_bills: selectedBills,
        management_fee_type: managementFeeType,
        management_fee_amount: managementFeeAmount ? parseFloat(managementFeeAmount) : null,
        street_name: streetName || null,
        company_name: companyName || null,
        notes: notes || null,
        payment_instructions: paymentInstructions || null,
      };

      if (property) {
        // Update existing property
        const { error: updateError } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', property.id);

        if (updateError) throw updateError;
      } else {
        // Insert new property
        const { error: insertError } = await supabase
          .from('properties')
          .insert([propertyData]);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Failed to save property. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {property ? 'Edit Property' : 'Add New Property'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label htmlFor="propertyName" className="block text-sm font-medium text-gray-700">
                  Property Name *
                </label>
                <input
                  type="text"
                  name="propertyName"
                  id="propertyName"
                  required
                  defaultValue={property?.name}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="units" className="block text-sm font-medium text-gray-700">
                  Number of Units *
                </label>
                <input
                  type="number"
                  name="units"
                  id="units"
                  required
                  min="1"
                  defaultValue={property?.units}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  id="city"
                  required
                  defaultValue={property?.city}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="streetName" className="block text-sm font-medium text-gray-700">
                  Street Name (optional)
                </label>
                <input
                  type="text"
                  name="streetName"
                  id="streetName"
                  defaultValue={property?.street_name || ''}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Utility Rates */}
            <div className="space-y-4">
              <div>
                <label htmlFor="waterRate" className="block text-sm font-medium text-gray-700">
                  Water Rate (KES per unit consumed)
                </label>
                <input
                  type="number"
                  name="waterRate"
                  id="waterRate"
                  step="0.01"
                  defaultValue={property?.water_rate || ''}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="electricityRate" className="block text-sm font-medium text-gray-700">
                  Electricity Rate (KES per unit consumed)
                </label>
                <input
                  type="number"
                  name="electricityRate"
                  id="electricityRate"
                  step="0.01"
                  defaultValue={property?.electricity_rate || ''}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MPESA Payment Method
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paybill"
                    checked={paymentMethod === 'paybill'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'paybill' | 'till')}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">Paybill</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="till"
                    checked={paymentMethod === 'till'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'paybill' | 'till')}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">Till Number</span>
                </label>
              </div>
              <input
                type="text"
                name="paymentNumber"
                id="paymentNumber"
                placeholder={paymentMethod === 'paybill' ? 'Paybill Number' : 'Till Number'}
                defaultValue={property?.payment_number || ''}
                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Recurring Bills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Other Recurring Bills
              </label>
              <div className="grid grid-cols-2 gap-2">
                {RECURRING_BILLS.map((bill) => (
                  <label key={bill} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedBills.includes(bill)}
                      onChange={() => handleBillToggle(bill)}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 capitalize">{bill.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Penalty Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rent Payment Penalty
              </label>
              <select
                name="penaltyType"
                value={penaltyType}
                onChange={(e) => setPenaltyType(e.target.value as 'fixed' | 'percentage_rent' | 'percentage_balance')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage_rent">Percentage of Rent</option>
                <option value="percentage_balance">Percentage of Balance</option>
              </select>
              <input
                type="number"
                name="penaltyAmount"
                id="penaltyAmount"
                step="0.01"
                defaultValue={property?.penalty_amount || ''}
                placeholder={
                  penaltyType === 'fixed'
                    ? 'Enter fixed penalty amount'
                    : penaltyType === 'percentage_rent'
                    ? 'Enter percentage of rent'
                    : 'Enter percentage of balance'
                }
                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <label className="inline-flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={autoPenalize}
                  onChange={(e) => setAutoPenalize(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="ml-2">Automatically penalize tenants upon late payment</span>
              </label>
            </div>

            {/* Tax Rate */}
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
                defaultValue={property?.tax_rate || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Management Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Management Fee
              </label>
              <select
                name="managementFeeType"
                value={managementFeeType}
                onChange={(e) => setManagementFeeType(e.target.value as 'fixed' | 'percentage')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage of Total Rent Collected</option>
              </select>
              <input
                type="number"
                name="managementFeeAmount"
                id="managementFeeAmount"
                step="0.01"
                defaultValue={property?.management_fee_amount || ''}
                placeholder={
                  managementFeeType === 'fixed'
                    ? 'Enter fixed fee amount'
                    : 'Enter percentage of total rent'
                }
                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                Company Name (Optional)
              </label>
              <input
                type="text"
                name="companyName"
                id="companyName"
                defaultValue={property?.company_name || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                id="notes"
                rows={3}
                defaultValue={property?.notes || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter any additional notes"
              />
            </div>

            <div>
              <label htmlFor="paymentInstructions" className="block text-sm font-medium text-gray-700">
                Payment Instructions (optional)
              </label>
              <textarea
                name="paymentInstructions"
                id="paymentInstructions"
                rows={3}
                defaultValue={property?.payment_instructions || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter payment instructions"
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
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (property ? 'Saving...' : 'Adding...') : (property ? 'Save Changes' : 'Add Property')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}