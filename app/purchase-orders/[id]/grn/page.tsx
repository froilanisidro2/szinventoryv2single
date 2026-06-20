'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, CheckCircle, XCircle, AlertCircle, Printer, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getSuppliers, getPurchaseOrderItems, autoCreateGRNFromPurchaseOrder, getGRNByPurchaseOrderId, getPurchaseOrderExpectedDeliveryDate } from '@/app/actions';
import { sendGRNNotificationEmail } from '@/app/actions/email';
import type { GRN } from '@/types';

const rejectionLabels: Record<string, string> = {
  damaged_in_transit: 'Damaged in Transit',
  defective: 'Defective/Non-Functional',
  wrong_item: 'Wrong Item',
  qty_mismatch: 'Quantity Mismatch',
  expired: 'Expired',
  quality_issue: 'Quality Issue',
  other: 'Other',
};

export default function GRNDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [grn, setGrn] = useState<GRN | null>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [poExpectedDelivery, setPoExpectedDelivery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadGRN();
    try {
      const c = JSON.parse(localStorage.getItem('company') || '{}');
      setCompany(c);
    } catch {}
  }, [id]);

  const loadGRN = async () => {
    try {
      setIsLoading(true);

      const grnRes = await getGRNByPurchaseOrderId(id);

      // If no GRN exists, auto-create from PO received items
      if (grnRes.error || !grnRes.data || (grnRes.data as any[]).length === 0) {
        const poItemsForGRN = await getPurchaseOrderItems(id);
        const items = Array.isArray(poItemsForGRN.data) ? poItemsForGRN.data : [];

        // Build receivedItems map from existing received quantities on PO items
        const receivedItemsMap: Record<string, any> = {};
        items.forEach((item: any) => {
          if (Number(item.quantity_received) > 0) {
            receivedItemsMap[item.id] = {
              itemId: item.id,
              quantity: Number(item.quantity_received),
              quantityAccepted: Number(item.quantity_accepted ?? item.quantity_received),
              quantityRejected: Number(item.quantity_rejected ?? 0),
              rejectionReason: item.rejection_reason || '',
              warehouseId: item.warehouse_id || '',
              binLocationId: item.bin_location_id || '',
            };
          }
        });

        if (Object.keys(receivedItemsMap).length === 0) {
          toast.error('No received items found to generate GRN');
          router.back();
          return;
        }

        const createResult = await autoCreateGRNFromPurchaseOrder(id, receivedItemsMap);
        if (createResult.error) {
          toast.error('Failed to auto-create GRN');
          router.back();
          return;
        }

        toast.success('GRN generated automatically');

        // Re-fetch the newly created GRN
        const retryRes = await getGRNByPurchaseOrderId(id);
        if (retryRes.error || !retryRes.data || (retryRes.data as any[]).length === 0) {
          toast.error('GRN created but could not be loaded');
          router.back();
          return;
        }
        // continue with the newly created GRN below
        const grnData = (retryRes.data as any[])[0];
        setGrn(grnData);

        const [suppliersRes, poItemsRes, poRes2] = await Promise.all([getSuppliers(), getPurchaseOrderItems(id), getPurchaseOrderExpectedDeliveryDate(id)]);
        if (suppliersRes.data) {
          const found = (suppliersRes.data as any[]).find((s: any) => s.id === grnData.supplier_id);
          setSupplier(found || null);
        }
        if (poItemsRes.data) setPoItems(Array.isArray(poItemsRes.data) ? poItemsRes.data : []);
        if (Array.isArray(poRes2.data) && poRes2.data.length > 0) setPoExpectedDelivery(poRes2.data[0].expected_delivery_date || null);
        return;
      }

      const grnData = (grnRes.data as any[])[0];
      setGrn(grnData);

      const [suppliersRes, poItemsRes, poRes] = await Promise.all([
        getSuppliers(),
        getPurchaseOrderItems(id),
        getPurchaseOrderExpectedDeliveryDate(grnData.purchase_order_id),
      ]);

      if (suppliersRes.data) {
        const found = (suppliersRes.data as any[]).find((s: any) => s.id === grnData.supplier_id);
        setSupplier(found || null);
      }

      if (poItemsRes.data) {
        setPoItems(Array.isArray(poItemsRes.data) ? poItemsRes.data : []);
      }

      if (Array.isArray(poRes.data) && poRes.data.length > 0) {
        setPoExpectedDelivery(poRes.data[0].expected_delivery_date || null);
      }
    } catch {
      toast.error('Failed to load GRN');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const buildEmailBody = (grnData: GRN) => {
    const companyName = company?.name || 'Our Company';
    const supplierName = supplier?.contact_person || supplier?.name || 'Supplier';
    const receiptDate = new Date(grnData.receipt_date).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const hasRejections = Number(grnData.total_items_rejected) > 0;
    const itemLines = poItems
      .filter(item => Number(item.quantity_received) > 0)
      .map(item => {
        const accepted = Number(item.quantity_accepted || 0);
        const rejected = Number(item.quantity_rejected || 0);
        const reason = item.rejection_reason
          ? ' (' + (rejectionLabels[item.rejection_reason] || item.rejection_reason) + ')'
          : '';
        return '  - ' + (item.description || 'Item') +
          ': Ordered ' + Number(item.quantity_ordered) +
          ', Accepted ' + accepted +
          (rejected > 0 ? ', Rejected ' + rejected + reason : '');
      }).join('\n') || '  (No items listed)';

    const rejNote = hasRejections
      ? '\nNOTE: ' + grnData.total_items_rejected + ' unit(s) were rejected. ' +
        'Please arrange for replacement or issue a credit note at your earliest convenience.\n'
      : '';

    return 'Dear ' + supplierName + ',\n\n' +
      'This is to confirm receipt of your delivery for GRN ' + grnData.grn_number + '.\n\n' +
      'GRN NUMBER: ' + grnData.grn_number + '\n' +
      'RECEIPT DATE: ' + receiptDate + '\n' +
      'QUALITY STATUS: ' + (grnData.quality_status === 'good' ? 'Fully Accepted' : 'Partially Accepted') + '\n\n' +
      'RECEIPT SUMMARY:\n' +
      '  Total Ordered  : ' + grnData.total_items_ordered + '\n' +
      '  Total Received : ' + grnData.total_items_received + '\n' +
      '  Accepted       : ' + grnData.total_items_accepted + '\n' +
      '  Rejected       : ' + grnData.total_items_rejected + '\n\n' +
      'ITEM DETAILS:\n' + itemLines + '\n' +
      rejNote + '\n' +
      'Thank you for your delivery. Please contact us if you have any concerns.\n\n' +
      'Best regards,\n' + companyName;
  };

  const openEmailModal = () => {
    if (!grn) return;
    setEmailTo(supplier?.email || '');
    setEmailSubject('Goods Receipt Confirmation — ' + grn.grn_number);
    setEmailBody(buildEmailBody(grn));
    setShowEmail(true);
  };

  const handleSendEmail = async () => {
    if (!grn) return;
    try {
      setIsSending(true);
      const companyName = company?.name || 'Our Company';
      const companyEmail = company?.email;

      const emailItems = poItems
        .filter(item => Number(item.quantity_received) > 0)
        .map(item => ({
          productName: item.description || 'Item',
          quantityOrdered: Number(item.quantity_ordered),
          quantityAccepted: Number(item.quantity_accepted || 0),
          quantityRejected: Number(item.quantity_rejected || 0),
          rejectionReason: item.rejection_reason,
        }));

      const result = await sendGRNNotificationEmail({
        supplierEmail: emailTo,
        supplierName: supplier?.contact_person || supplier?.name || 'Supplier',
        companyName,
        companyEmail,
        poNumber: 'GRN ' + grn.grn_number,
        receivedDate: new Date(grn.receipt_date).toLocaleDateString('en-PH', {
          year: 'numeric', month: 'long', day: 'numeric',
        }),
        items: emailItems,
        notes: emailBody,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to send email');
        return;
      }
      toast.success('GRN notification sent to ' + emailTo);
      setShowEmail(false);
    } catch {
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading GRN...</p>
        </div>
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">GRN not found</p>
      </div>
    );
  }

  const allAccepted = Number(grn.total_items_rejected) === 0;
  const receivedPoItems = poItems.filter(i => Number(i.quantity_received) > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button href={`/purchase-orders/${id}`} variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to PO
            </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{grn.grn_number}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                allAccepted
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {allAccepted ? 'FULLY ACCEPTED' : 'PARTIALLY ACCEPTED'}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Goods Receipt Note — {new Date(grn.receipt_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.open(`/purchase-orders/${id}/grn/print`, '_blank')}>
            Print GRN
          </Button>
          <Button variant="primary" icon={<Mail className="h-4 w-4" />} onClick={openEmailModal}>
            Send GRN to Supplier
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — details + items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Receipt Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">GRN Number</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{grn.grn_number}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Received Date</p>
                <p className="font-semibold text-green-600 dark:text-green-400 mt-0.5">
                  {new Date(grn.receipt_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Expected Delivery</p>
                {poExpectedDelivery ? (
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                      {new Date(poExpectedDelivery).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {(() => {
                      const diff = Math.round((new Date(grn.receipt_date).getTime() - new Date(poExpectedDelivery).getTime()) / 86400000);
                      if (diff === 0) return <p className="text-xs text-green-500 mt-0.5">On time</p>;
                      if (diff > 0) return <p className="text-xs text-red-500 mt-0.5">{diff} day{diff !== 1 ? 's' : ''} late</p>;
                      return <p className="text-xs text-green-500 mt-0.5">{Math.abs(diff)} day{Math.abs(diff) !== 1 ? 's' : ''} early</p>;
                    })()}
                  </div>
                ) : (
                  <p className="font-semibold text-gray-400 dark:text-gray-500 mt-0.5">Not set on PO</p>
                )}
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Supplier</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{supplier?.name || '—'}</p>
                {supplier?.email && <p className="text-xs text-gray-400 mt-0.5">{supplier.email}</p>}
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5 capitalize">{grn.status}</p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Received Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Ordered</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Received</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wide">Accepted ✓</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-red-600 uppercase tracking-wide">Rejected ✗</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {receivedPoItems.length > 0 ? receivedPoItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.description || 'Item'}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{Number(item.quantity_ordered).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{Number(item.quantity_received).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {Number(item.quantity_accepted || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {Number(item.quantity_rejected) > 0 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            {Number(item.quantity_rejected).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {item.rejection_reason ? (rejectionLabels[item.rejection_reason] || item.rejection_reason) : '—'}
                        {item.qc_notes && <p className="text-xs text-gray-400 mt-0.5 italic">{item.qc_notes}</p>}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">No received items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right — summary + email CTA */}
        <div className="space-y-4">
          <div className="card p-5 space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Receipt Summary</h3>
            {[
              { label: 'Total Ordered', value: grn.total_items_ordered },
              { label: 'Total Received', value: grn.total_items_received },
              { label: 'Accepted ✓', value: grn.total_items_accepted, color: 'text-green-600 dark:text-green-400 font-bold' },
              { label: 'Rejected ✗', value: grn.total_items_rejected, color: 'text-red-600 dark:text-red-400 font-bold' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                <span className={row.color || 'font-semibold text-gray-900 dark:text-white'}>{Number(row.value).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="card p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-1">Notify Supplier</h3>
            <p className="text-xs text-primary-700 dark:text-primary-300 mb-3">
              Send a receipt confirmation to {supplier?.name || 'the supplier'}.
              {!supplier?.email && ' No email on file — you can enter one manually.'}
            </p>
            <Button variant="primary" className="w-full gap-2" onClick={openEmailModal}>
              <Mail className="h-4 w-4" />
              Send GRN Email
            </Button>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary-600" />
                  Send GRN to Supplier
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{grn.grn_number}</p>
              </div>
              <button onClick={() => setShowEmail(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To (Supplier Email)</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="supplier@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {!emailTo && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No email on file — enter manually.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message Body <span className="text-gray-400 font-normal">(editable)</span>
                </label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono resize-none"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A formatted HTML email with the full GRN breakdown will be sent to the supplier.
              </p>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2 flex-shrink-0">
              <Button variant="primary" className="w-full gap-2" onClick={handleSendEmail} disabled={isSending || !emailTo}>
                <Mail className="h-4 w-4" />
                {isSending ? 'Sending...' : 'Send to ' + (emailTo || '...')}
              </Button>
              <button onClick={() => setShowEmail(false)} className="text-sm text-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 py-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
