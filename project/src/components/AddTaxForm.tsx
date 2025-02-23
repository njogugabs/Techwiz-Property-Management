import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tax {
  id: string;
  name: string;
  percentage: number;
  created_at: string;
}

interface AddTaxFormProps {
  tax?: Tax;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTaxForm({ tax, onClose, onSuccess }: AddTaxFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(tax?.name || '');
  const [percentage, setPercentage] = useState<number | ''>(tax?.percentage || '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      if (!name || !percentage) {
        alert('Please fill in all required fields');
        return;
      }

      if (tax) {
        // Update existing tax
        const { error } = await supabase
          .from('taxes')
          .update({
            name,
            percentage: Number(percentage)
          })
          .eq('id', tax.id);

        if (error) throw error;
      } else {
        // Create new tax
        const { error } = await supabase
          .from('taxes')
          .insert([{
            owner_id: user.id,
            name,
            percentage: Number(percentage)
          }]);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving tax:', error);
      alert('Failed to save tax. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {tax ? 'Edit Tax' : 'Add New Tax'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Tax Name *
            </label>
            <input
              type="text"
              name="name"
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., VAT, Sales Tax"
            />
          </div>

          <div>
            <label htmlFor="percentage" className="block text-sm font-medium text-gray-700">
              Percentage *
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="number"
                name="percentage"
                id="percentage"
                required
                min="0"
                max="100"
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value ? Number(e.target.value) : '')}
                className="block w-full pr-12 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
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
              {loading ? (tax ? 'Saving...' : 'Adding...') : (tax ? 'Save Changes' : 'Add Tax')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}