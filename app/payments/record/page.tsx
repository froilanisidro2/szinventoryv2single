'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPayment, getInvoices } from '@/app/actions';

interface PaymentFormData {
  invoiceId: string;
  amount: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer';
  paymentDate: string;
  reference: string;
  notes: string;
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState<PaymentFormData>({
    invoiceId: '',
    amount: '',
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0] ?? '',
    reference: '',
    notes: '',
  });

  // Fetch invoices on mount
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const result = await getInvoices();
        if (!result.error && result.data) {
          setInvoices(result.data);
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
      }
    };

    loadInvoices();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.invoiceId) newErrors.invoiceId = 'Invoice is required';
    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.paymentMethod) newErrors.paymentMethod = 'Payment method is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      const result = await createPayment({
        company_id: defaultCompanyId,
        invoice_id: formData.invoiceId,
        amount: parseFloat(formData.amount),
        payment_method: formData.paymentMethod,
        payment_date: formData.paymentDate,
        transaction_reference: formData.reference,
        notes: formData.notes,
      });

      if (result.error) {
        toast.error(result.error.message || 'Failed to record payment');
        setIsLoading(false);
        return;
      }

      toast.success('Payment recorded successfully');
      router.push('/payments');
    } catch (error) {
      toast.error('An error occurred while recording payment');
      setIsLoading(false);
    }
  };

  const selectedInvoice = invoices.find(inv => inv.id === formData.invoiceId);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/payments">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Record Payment
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Record a new payment for an invoice
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 space-y-6">
            {/* Invoice Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary-600" />
                Invoice Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Invoice *
                </label>
                <select
                  name="invoiceId"
                  value={formData.invoiceId}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.invoiceId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Select an invoice</option>
                  {invoices.map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.number} - {invoice.customer} (${invoice.amount.toFixed(2)})
                    </option>
                  ))}
                </select>
                {errors.invoiceId && <p className="text-red-500 text-sm mt-1">{errors.invoiceId}</p>}
              </div>
            </div>

            {/* Invoice Summary */}
            {selectedInvoice && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Invoice Number</p>
                    <p className="font-semibold text-blue-900 dark:text-blue-200">{selectedInvoice.number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Customer</p>
                    <p className="font-semibold text-blue-900 dark:text-blue-200">{selectedInvoice.customer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Invoice Amount</p>
                    <p className="font-semibold text-blue-900 dark:text-blue-200">${selectedInvoice.amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Payment Details
              </h3>

              <div className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2 text-gray-500 dark:text-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className={`w-full pl-8 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                  </div>
                  {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
                  {selectedInvoice && parseFloat(formData.amount) > selectedInvoice.amount && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                      ⚠️ Payment exceeds invoice amount
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method *
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={handleChange}
                    placeholder="e.g., Check #12345 or Transaction ID"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Add any additional notes about this payment..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link href="/payments" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 gap-2"
                disabled={isLoading}
              >
                <Save className="h-4 w-4" />
                {isLoading ? 'Recording Payment...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4">
          <div className="card p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">Payment Methods</h4>
            <ul className="text-sm text-green-800 dark:text-green-300 space-y-1">
              <li>✓ Cash payments</li>
              <li>✓ Checks</li>
              <li>✓ Credit/Debit cards</li>
              <li>✓ Bank transfers</li>
            </ul>
          </div>

          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Partial Payments</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
              You can record partial payments for invoices. The remaining balance will be carried forward.
            </p>
          </div>

          <div className="card p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Automatic Receipts</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Receipt will be automatically generated and sent to the customer.
            </p>
            <Button variant="secondary" className="w-full text-sm">
              View Templates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
