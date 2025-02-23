import React, { useState, useEffect } from 'react';
import { X, Download, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../lib/types';

interface ViewInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
}

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  type: string;
}

interface InvoiceDetails extends Invoice {
  property: { name: string };
  unit: { name: string };
  tenant: { 
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  items: InvoiceItem[];
}

export function ViewInvoiceModal({ invoice, onClose }: ViewInvoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoice.id]);

  const fetchInvoiceDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          property:properties(name),
          unit:units(name),
          tenant:tenants(first_name, last_name, email, phone),
          items:invoice_items(*)
        `)
        .eq('id', invoice.id)
        .single();

      if (error) throw error;
      setInvoiceDetails(data);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      alert('Failed to fetch invoice details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoicePDF = () => {
    if (!invoiceDetails) return;

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${invoiceDetails.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .invoice-header {
            text-align: center;
            margin-bottom: 30px;
          }
          .invoice-details {
            margin-bottom: 30px;
          }
          .invoice-details div {
            margin-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #f8f9fa;
          }
          .total-section {
            text-align: right;
            margin-top: 20px;
          }
          .total-section div {
            margin-bottom: 10px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>INVOICE</h1>
          <h2>#${invoiceDetails.invoice_number}</h2>
        </div>

        <div class="invoice-details">
          <div>
            <strong>From:</strong><br>
            Techwiz Property Management<br>
            [Your Address]<br>
            [Your Contact Info]
          </div>

          <div>
            <strong>To:</strong><br>
            ${invoiceDetails.tenant.first_name} ${invoiceDetails.tenant.last_name}<br>
            ${invoiceDetails.property.name} - Unit ${invoiceDetails.unit.name}<br>
            Phone: ${invoiceDetails.tenant.phone}<br>
            Email: ${invoiceDetails.tenant.email}
          </div>

          <div>
            <strong>Invoice Date:</strong> ${new Date(invoiceDetails.created_at).toLocaleDateString()}<br>
            <strong>Due Date:</strong> ${new Date(invoiceDetails.due_date).toLocaleDateString()}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceDetails.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td style="text-align: right">$${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td style="text-align: right"><strong>Subtotal:</strong></td>
              <td style="text-align: right">$${invoiceDetails.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align: right"><strong>Tax:</strong></td>
              <td style="text-align: right">$${invoiceDetails.tax_amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="text-align: right"><strong>Total:</strong></td>
              <td style="text-align: right">$${invoiceDetails.total_amount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>
            Payment is due by ${new Date(invoiceDetails.due_date).toLocaleDateString()}.<br>
            Please include invoice number ${invoiceDetails.invoice_number} with your payment.
          </p>
        </div>
      </body>
      </html>
    `;

    // Create a Blob from the HTML content
    const blob = new Blob([invoiceHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    // Create a link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${invoiceDetails.invoice_number}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleSendInvoice = async () => {
    if (!invoiceDetails) return;

    try {
      setLoading(true);

      // Update invoice status to 'sent'
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      if (error) throw error;

      // Here you would typically integrate with an email service
      // For now, we'll just show a success message
      alert('Invoice has been marked as sent.');
      
      await fetchInvoiceDetails();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !invoiceDetails) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Invoice #{invoiceDetails.invoice_number}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700">From</h4>
              <div className="mt-2 text-sm text-gray-900">
                <p>Techwiz Property Management</p>
                <p>[Your Address]</p>
                <p>[Your Contact Info]</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700">To</h4>
              <div className="mt-2 text-sm text-gray-900">
                <p>{invoiceDetails.tenant.first_name} {invoiceDetails.tenant.last_name}</p>
                <p>{invoiceDetails.property.name} - Unit {invoiceDetails.unit.name}</p>
                <p>Phone: {invoiceDetails.tenant.phone}</p>
                <p>Email: {invoiceDetails.tenant.email}</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Invoice Details</h4>
              <div className="mt-2 text-sm text-gray-900">
                <p>Invoice Number: {invoiceDetails.invoice_number}</p>
                <p>Date: {new Date(invoiceDetails.created_at).toLocaleDateString()}</p>
                <p>Due Date: {new Date(invoiceDetails.due_date).toLocaleDateString()}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700">Status</h4>
              <div className="mt-2">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${invoiceDetails.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoiceDetails.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    invoiceDetails.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'}`}
                >
                  {invoiceDetails.status.charAt(0).toUpperCase() + invoiceDetails.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Invoice Items</h4>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoiceDetails.items.map((item) => (
                  <tr key={item.id}>
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
                    ${invoiceDetails.subtotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    Tax:
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    ${invoiceDetails.tax_amount.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    ${invoiceDetails.total_amount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={generateInvoicePDF}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
            {invoiceDetails.status === 'draft' && (
              <button
                onClick={handleSendInvoice}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}