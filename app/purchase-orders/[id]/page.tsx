'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Printer, Mail, RotateCcw, Calendar, Truck, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getPurchaseOrderById,
  getPurchaseOrderItems,
  getSuppliers,
  updatePurchaseOrder,
  getSupplierReturnsByPO,
  shouldTrackBatchesForProduct,
  getBatchesForProduct,
  type ProductBatch,
} from '@/app/actions';
import { apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import { sendPurchaseOrderEmail } from '@/app/actions/email';
import { hasPermission, getCurrentUser } from '@/lib/auth-utils';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  contact_person?: string;
  vat_type?: 'vat' | 'non_vat';
  vat_rate?: number | null;
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [grnReceiptDate, setGrnReceiptDate] = useState<string | null>(null);
  const [itemBatches, setItemBatches] = useState<Record<string, ProductBatch[]>>({});
  const [canManageInbound, setCanManageInbound] = useState(false);
  const [currentRole, setCurrentRole] = useState('');

  useEffect(() => {
    setCanManageInbound(hasPermission('po:receive') || hasPermission('inventory:write'));
    setCurrentRole(getCurrentUser()?.role ?? '');
  }, []);

  // Format number with commas
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    loadPurchaseOrderDetails();
  }, [id]);

  const loadPurchaseOrderDetails = async () => {
    try {
      setIsLoading(true);
      const [orderResponse, itemsResponse, suppliersResponse, returnsResponse, grnResponse] = await Promise.all([
        getPurchaseOrderById(id),
        getPurchaseOrderItems(id),
        getSuppliers(),
        getSupplierReturnsByPO(id),
        apiGet<any[]>(`${API_ENDPOINTS.GRN}?purchase_order_id=eq.${id}&select=receipt_date&limit=1`),
      ]);

      if (orderResponse.error) {
        toast.error('Failed to load purchase order');
        router.back();
        return;
      }

      const orderData = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;
      setOrder(orderData);

      const itemsData = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setItems(itemsData);
      setSupplierReturns(Array.isArray(returnsResponse.data) ? returnsResponse.data : []);

      // Load batches for batch-tracked products
      const batchMap: Record<string, ProductBatch[]> = {};
      for (const item of itemsData) {
        if (!item.product_id) continue;
        const { shouldTrack } = await shouldTrackBatchesForProduct(item.product_id);
        if (shouldTrack) {
          const batchResult = await getBatchesForProduct(item.product_id);
          if (!batchResult.error && Array.isArray(batchResult.data)) {
            batchMap[item.product_id] = batchResult.data;
          }
        }
      }
      setItemBatches(batchMap);
      if (Array.isArray(grnResponse.data) && grnResponse.data.length > 0) {
        setGrnReceiptDate(grnResponse.data[0].receipt_date);
      }

      // Create supplier map
      if (suppliersResponse.data && Array.isArray(suppliersResponse.data)) {
        const supplierMap: Record<string, Supplier> = {};
        suppliersResponse.data.forEach((supplier: any) => {
          supplierMap[supplier.id] = supplier;
        });
        setSuppliers(supplierMap);
      }
    } catch (error) {
      toast.error('Error loading purchase order details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;

    try {
      setIsUpdating(true);
      const result = await updatePurchaseOrder(order.id, {
        status: newStatus,
        sent_at: newStatus === 'sent' ? new Date().toISOString() : order.sent_at,
      });

      if (result.error) {
        toast.error('Failed to update purchase order status');
        return;
      }

      setOrder({ ...order, status: newStatus as any });
      toast.success(`Purchase order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Error updating purchase order');
    } finally {
      setIsUpdating(false);
    }
  };

  const buildEmailBody = (supplierName: string, companyName: string) => {
    const fmt = (n: number) => `₱ ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const itemLines = items.map((item: any, i: number) =>
      `  ${i + 1}. ${item.description || item.product_name || 'Item'} — Qty: ${item.quantity_ordered}, Unit Price: ${fmt(item.unit_price)}, Total: ${fmt(Number(item.quantity_ordered) * Number(item.unit_price))}`
    ).join('\n');

    return `Dear ${supplierName},

Please find below our Purchase Order details:

PO Number: ${order?.po_number}
Order Date: ${order?.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
${order?.expected_delivery_date ? `Expected Delivery: ${new Date(order.expected_delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
${order?.payment_terms ? `Payment Terms: ${order.payment_terms}` : ''}

LINE ITEMS:
${itemLines}

Subtotal: ${fmt(Number(order?.subtotal))}
Tax: ${fmt(Number(order?.tax_amount))}
${Number(order?.shipping_cost) > 0 ? `Shipping: ${fmt(Number(order?.shipping_cost))}` : ''}
Total Amount: ${fmt(Number(order?.total_amount))}

${order?.notes ? `Notes: ${order.notes}\n` : ''}
Please confirm receipt of this Purchase Order at your earliest convenience.

Best regards,
${companyName}`;
  };

  const openSendModal = () => {
    if (!order) return;
    const supplier = suppliers[order.supplier_id] as Supplier | undefined;
    let companyName = 'Our Company';
    try {
      const c = JSON.parse(localStorage.getItem('company') || '{}');
      companyName = c.name || companyName;
    } catch {}
    setEmailTo(supplier?.email || '');
    setEmailSubject(`Purchase Order ${order.po_number} from ${companyName}`);
    setEmailBody(buildEmailBody(supplier?.contact_person || supplier?.name || 'Supplier', companyName));
    setShowSendModal(true);
  };

  const handleSendPO = async () => {
    if (!order) return;
    try {
      setIsSendingEmail(true);
      let companyName = 'Our Company';
      let companyEmail: string | undefined;
      try {
        const c = JSON.parse(localStorage.getItem('company') || '{}');
        companyName = c.name || companyName;
        companyEmail = c.email;
      } catch {}

      const result = await sendPurchaseOrderEmail({
        supplierEmail: emailTo,
        supplierName: (suppliers[order.supplier_id] as Supplier)?.contact_person || (suppliers[order.supplier_id] as Supplier)?.name || 'Supplier',
        companyName,
        companyEmail,
        poNumber: order.po_number,
        orderDate: new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        expectedDelivery: order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
        paymentTerms: order.payment_terms,
        notes: emailBody,
        items: items.map((item: any) => ({
          productName: item.description || item.product_name || 'Item',
          quantity: Number(item.quantity_ordered),
          unit_cost: Number(item.unit_price),
          subtotal: Number(item.quantity_ordered) * Number(item.unit_price),
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.tax_amount),
        shippingCost: Number(order.shipping_cost || 0),
        totalAmount: Number(order.total_amount),
        currency: 'PHP',
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to send email');
        return;
      }
      await handleStatusChange('sent');
      setShowSendModal(false);
      toast.success(`Purchase Order emailed to ${emailTo}`);
    } catch (err) {
      console.error('[PO EMAIL]', err);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintPO = () => {
    window.open(`/purchase-orders/${id}/print`, '_blank');
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Purchase order not found</p>
      </div>
    );
  }

  const supplier = suppliers[order.supplier_id];
  
  // Status display labels
  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      draft: 'New',
      confirmed: 'Approved',
      sent: 'Sent',
      partially_received: 'Confirmed',
      received: 'Received',
      cancelled: 'Cancelled',
    };
    return statusLabels[status] || status;
  };
  
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    partially_received: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-6 p-6">
      <style>{`
        @media print {
          * { margin: 0; padding: 0; }
          body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; }
          header { display: none !important; visibility: hidden !important; }
          nav { display: none !important; visibility: hidden !important; }
          .print-hide { display: none !important; visibility: hidden !important; }
          .print-show { display: block !important; }
          #po-content { background: white; border: none !important; }
          .po-header { border-bottom: 2px solid #333; padding: 15px 0; margin-bottom: 20px; }
          .po-title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .po-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 25px; font-size: 11px; }
          .po-detail-item { }
          .po-detail-label { font-weight: bold; margin-bottom: 3px; color: #333; }
          .po-detail-value { font-size: 12px; color: #000; }
          .from-to-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px; font-size: 11px; }
          .from-to-block { }
          .from-to-label { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
          .from-to-content { font-size: 11px; line-height: 1.5; color: #000; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          table th { background: #f5f5f5; font-weight: bold; font-size: 11px; padding: 6px 4px; border: 1px solid #999; text-align: left; }
          table td { font-size: 11px; padding: 5px 4px; border: 1px solid #ddd; text-align: left; }
          table td:nth-child(2), table td:nth-child(3), table td:nth-child(4), table td:nth-child(5) { text-align: right; }
          table th:nth-child(2), table th:nth-child(3), table th:nth-child(4), table th:nth-child(5) { text-align: right; }
          .order-summary { margin: 10px 0 0 0; padding: 0; width: 40%; margin-left: auto; }
          .order-summary-header { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
          .summary-row { font-size: 11px; display: flex; justify-content: space-between; padding: 2px 0; }
          .summary-total { font-weight: bold; border-top: 1px solid #999; padding-top: 4px; margin-top: 4px; font-size: 12px; display: flex; justify-content: space-between; }
          .signature-section { display: none !important; }
        }
        @media print {
          @page { margin: 12mm; size: A4; }
        }
      `}</style>

      <div id="po-content" className="print:border-0">
        {/* Web Header - Hide completely on print */}
        <div className="flex items-center justify-between print-hide mb-6">
          <div className="flex items-center gap-4">
            <Link href="/purchase-orders">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{order.po_number}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Created {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Printer className="h-4 w-4" />}
              onClick={handlePrintPO}
              disabled={isUpdating}
            >
              Print PO
            </Button>
          </div>
        </div>

        {/* Professional Print Header */}
        <div className="print-show hidden po-header">
          <div className="po-title">PURCHASE ORDER</div>
          
          {/* PO Details */}
          <div className="po-details">
            <div className="po-detail-item">
              <div className="po-detail-label">PO Number:</div>
              <div className="po-detail-value">{order.po_number}</div>
            </div>
            <div className="po-detail-item">
              <div className="po-detail-label">Date:</div>
              <div className="po-detail-value">{new Date(order.order_date).toLocaleDateString('en-PH')}</div>
            </div>
          </div>
          
          {/* From and To Section */}
          <div className="from-to-section">
            <div className="from-to-block">
              <div className="from-to-label">FROM:</div>
              <div className="from-to-content">
                <strong>Test1</strong><br />
                Requestor
              </div>
            </div>
            <div className="from-to-block">
              <div className="from-to-label">TO:</div>
              <div className="from-to-content">
                <strong>{supplier?.name || 'Unknown Supplier'}</strong><br />
                Payment Terms: {order.payment_terms || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Status + Dates Bar - Hide on print */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-4 print-hide">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Order Date
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {new Date(order.order_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Truck className="h-3 w-3" /> Expected Delivery
            </p>
            <p className={`text-sm font-semibold ${order.expected_delivery_date ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              {order.expected_delivery_date
                ? new Date(order.expected_delivery_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <PackageCheck className="h-3 w-3" /> Received Date
            </p>
            {grnReceiptDate ? (
              <div>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {new Date(grnReceiptDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
                {order.expected_delivery_date && (() => {
                  const diff = Math.round((new Date(grnReceiptDate).getTime() - new Date(order.expected_delivery_date).getTime()) / 86400000);
                  if (diff === 0) return <p className="text-xs text-green-500 mt-0.5">On time</p>;
                  if (diff > 0) return <p className="text-xs text-red-500 mt-0.5">{diff}d late</p>;
                  return <p className="text-xs text-green-500 mt-0.5">{Math.abs(diff)}d early</p>;
                })()}
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">Not yet received</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print:block">
          {/* Left Column - Full width on print */}
          <div className="lg:col-span-2 space-y-6 print:space-y-3">
            {/* Supplier Info + editable Payment Terms / Shipping */}
            <div className="card p-6 print:hidden">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                To: {supplier?.name || 'Unknown'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Payment Terms</label>
                  {order.status === 'received' || order.status === 'cancelled' ? (
                    <p className="font-medium text-gray-900 dark:text-white">{order.payment_terms || '—'}</p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue={order.payment_terms || ''}
                        onBlur={async (e) => {
                          if (e.target.value !== (order.payment_terms || '')) {
                            await updatePurchaseOrder(order.id, { payment_terms: e.target.value });
                            setOrder({ ...order, payment_terms: e.target.value });
                            toast.success('Payment terms updated');
                          }
                        }}
                        placeholder="e.g., Net 30, Prepaid"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Shipping Cost (₱)</label>
                  {order.status === 'received' || order.status === 'cancelled' ? (
                    <p className="font-medium text-gray-900 dark:text-white">₱{formatCurrency(order.shipping_cost || 0)}</p>
                  ) : (
                    <input
                      type="number"
                      defaultValue={order.shipping_cost || 0}
                      min="0"
                      step="0.01"
                      onBlur={async (e) => {
                        const newShipping = parseFloat(e.target.value) || 0;
                        const newTotal = Number(order.subtotal) + Number(order.tax_amount) + newShipping;
                        await updatePurchaseOrder(order.id, { shipping_cost: newShipping, total_amount: newTotal });
                        setOrder({ ...order, shipping_cost: newShipping, total_amount: newTotal });
                        toast.success('Shipping cost updated');
                      }}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="card overflow-hidden print:bg-transparent print:border-0">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 print:p-0 print:border-0 print:mb-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white print:hidden">Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full print:text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 print:bg-white print:border print:border-gray-400">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1 min-w-[220px]">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Batch #
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Mfg Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Exp Date
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Qty Ordered
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Qty Received
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 print:px-2 print:py-1">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.length > 0 ? (
                      items.map((item) => {
                        const batches = itemBatches[item.product_id!] || [];
                        const hasBatches = batches.length > 0;
                        const fmt = (d: string) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
                        if (hasBatches) {
                          return batches.map((batch, bi) => {
                            const isExpired = batch.expiration_date && new Date(batch.expiration_date) < new Date();
                            const daysLeft = batch.expiration_date
                              ? Math.ceil((new Date(batch.expiration_date).getTime() - Date.now()) / 86400000)
                              : null;
                            return (
                              <tr key={`${item.id}-${batch.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 print:hover:bg-white">
                                {bi === 0 && (
                                  <td className="px-6 py-4 print:px-2 print:py-1 align-top min-w-[220px] max-w-[320px]" rowSpan={batches.length}>
                                    <p className="font-medium text-gray-900 dark:text-white print:text-xs whitespace-normal">
                                      {item.product?.name || item.description}
                                    </p>
                                    {item.product?.sku && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.product.sku}</p>
                                    )}
                                  </td>
                                )}
                                <td className="px-6 py-4 print:px-2 print:py-1">
                                  <span className="inline-block px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold">
                                    {batch.batch_number}
                                  </span>
                                </td>
                                <td className="px-6 py-4 print:px-2 print:py-1 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {batch.mfg_date ? fmt(batch.mfg_date) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                                <td className="px-6 py-4 print:px-2 print:py-1 whitespace-nowrap">
                                  {batch.expiration_date ? (
                                    <span className={`text-xs font-medium ${isExpired ? 'text-red-600 dark:text-red-400' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                      {fmt(batch.expiration_date)}
                                      {daysLeft !== null && !isExpired && <span className="ml-1 text-gray-400">({daysLeft}d)</span>}
                                      {isExpired && <span className="ml-1 text-red-500 font-bold">[EXP]</span>}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                  )}
                                </td>
                                {bi === 0 && (
                                  <>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1 align-top" rowSpan={batches.length}>
                                      {parseFloat(String(item.quantity_ordered)).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1 align-top" rowSpan={batches.length}>
                                      {parseFloat(String(item.quantity_received)).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1 align-top" rowSpan={batches.length}>
                                      ₱{formatCurrency(parseFloat(String(item.unit_price)))}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white print:px-2 print:py-1 align-top" rowSpan={batches.length}>
                                      ₱{formatCurrency(parseFloat(String(item.quantity_ordered)) * parseFloat(String(item.unit_price)))}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          });
                        }
                        return (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 print:hover:bg-white">
                            <td className="px-6 py-4 print:px-2 print:py-1 min-w-[220px] max-w-[320px]">
                              <p className="font-medium text-gray-900 dark:text-white print:text-xs whitespace-normal">
                                {item.product?.name || item.description}
                              </p>
                              {item.product?.sku && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.product.sku}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 print:px-2 print:py-1 text-xs text-gray-300 dark:text-gray-600">—</td>
                            <td className="px-6 py-4 print:px-2 print:py-1 text-xs text-gray-300 dark:text-gray-600">—</td>
                            <td className="px-6 py-4 print:px-2 print:py-1 text-xs text-gray-300 dark:text-gray-600">—</td>
                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1">
                              {parseFloat(String(item.quantity_ordered)).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1">
                              {parseFloat(String(item.quantity_received)).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-900 dark:text-white print:px-2 print:py-1">
                              ₱{formatCurrency(parseFloat(String(item.unit_price)))}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white print:px-2 print:py-1">
                              ₱{formatCurrency(parseFloat(String(item.quantity_ordered)) * parseFloat(String(item.unit_price)))}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No items in this purchase order
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Supplier Returns */}
            {supplierReturns.length > 0 && (
              <div className="card overflow-hidden print-hide">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-orange-500" />
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Supplier Returns
                  </h2>
                  <span className="ml-auto text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                    {supplierReturns.length} return{supplierReturns.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                        <th className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Qty Returned</th>
                        <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Notes</th>
                        <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {supplierReturns.map((ret) => {
                        const unitPrice = items.find((i: any) => i.product_id === ret.product_id)?.unit_price;
                        const returnValue = unitPrice ? Number(unitPrice) * Number(ret.quantity) : null;
                        return (
                          <tr key={ret.id} className="hover:bg-orange-50/40 dark:hover:bg-orange-900/10">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">{ret.product_name}</p>
                              {ret.product_sku && <p className="text-xs text-gray-400">{ret.product_sku}</p>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="font-semibold text-orange-600 dark:text-orange-400">{ret.quantity}</span>
                              {returnValue !== null && (
                                <p className="text-xs text-gray-400 mt-0.5">≈ ₱{formatCurrency(returnValue)}</p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-400 max-w-xs">
                              <p className="truncate text-xs">{ret.notes?.replace(/^\[RETURN_TO_SUPPLIER\]\s*/, '') || '—'}</p>
                            </td>
                            <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                              {new Date(ret.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <tr>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Returned</td>
                        <td className="px-5 py-3 text-right font-bold text-orange-600 dark:text-orange-400">
                          {supplierReturns.reduce((sum, r) => sum + Number(r.quantity), 0)} units
                        </td>
                        <td colSpan={2} className="px-5 py-3 text-xs text-gray-400">
                          {(() => {
                            const totalVal = supplierReturns.reduce((sum, r) => {
                              const unitPrice = items.find((i: any) => i.product_id === r.product_id)?.unit_price;
                              return sum + (unitPrice ? Number(unitPrice) * Number(r.quantity) : 0);
                            }, 0);
                            return totalVal > 0 ? `≈ ₱${formatCurrency(totalVal)} credit expected` : '';
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary - Hidden on print except for totals */}
          <div className="space-y-6 print:col-span-1 lg:col-span-1">
            {/* Totals - Compact on print */}
            <div className="card p-6 print:p-0 print:border-0 print:bg-transparent order-summary">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 print:text-sm">Order Summary</h2>

              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 print:py-1 print:text-xs summary-row">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">₱{formatCurrency(order.subtotal)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 print:py-1 print:text-xs summary-row">
                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  Tax
                  {supplier?.vat_type && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium print:hidden ${
                      supplier.vat_type === 'vat'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {supplier.vat_type === 'vat'
                        ? `VAT${supplier.vat_rate != null ? ` (${supplier.vat_rate}%)` : ''}`
                        : 'Non-VAT'}
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">₱{formatCurrency(order.tax_amount || 0)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 print:py-1 print:text-xs summary-row">
                <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ₱{formatCurrency(order.shipping_cost || 0)}
                </span>
              </div>

              <div className="flex justify-between py-3 bg-gray-50 dark:bg-gray-700 px-3 rounded print:py-1 print:text-xs print:bg-transparent print:border-t print:border-gray-400 summary-total">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-xl font-bold text-primary-600 print:text-sm">₱{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            {/* Signature Section - Completely Hidden */}
            {/* Removed entirely - no signature section on print */}

            {/* Order Info - Completely removed */}

            {/* Status Actions - Hide on print */}
            {order.status !== 'cancelled' && (
              <div className="card p-6 print-hide">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Quick Actions</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {canManageInbound ? 'Admin / Manager' : 'View only — Admin or Manager required'}
                </p>
                <div className="space-y-2">
                  {/* Draft → Approve (Admin, Manager) */}
                  {order.status === 'draft' && (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => handleStatusChange('confirmed')}
                      disabled={isUpdating || !canManageInbound}
                      title={!canManageInbound ? 'Requires Admin or Manager role' : 'Approve this Purchase Order'}
                    >
                      Approve
                    </Button>
                  )}

                  {/* Confirmed → Sent (Admin, Manager) */}
                  {order.status === 'confirmed' && (() => {
                    const supplier = suppliers[order.supplier_id] as Supplier | undefined;
                    const hasEmail = !!supplier?.email;
                    return (
                      <div className="space-y-2">
                        <Button
                          variant="primary"
                          className="w-full gap-2"
                          onClick={openSendModal}
                          disabled={isUpdating || !canManageInbound}
                          title={!canManageInbound ? 'Requires Admin or Manager role' : 'Send this PO to supplier'}
                        >
                          <Mail className="h-4 w-4" />
                          Send to Supplier
                        </Button>
                        {hasEmail
                          ? <p className="text-xs text-center text-gray-500 dark:text-gray-400">Supplier: {supplier?.email}</p>
                          : <p className="text-xs text-center text-amber-600 dark:text-amber-400">No email on file</p>
                        }
                      </div>
                    );
                  })()}

                  {/* Sent → Confirmed/Acknowledged (Admin, Manager) */}
                  {order.status === 'sent' && (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => handleStatusChange('partially_received')}
                      disabled={isUpdating || !canManageInbound}
                      title={!canManageInbound ? 'Requires Admin or Manager role' : 'Confirm supplier acknowledged the PO'}
                    >
                      Confirm Receipt
                    </Button>
                  )}

                  {/* Partially Received → Receive (Admin, Manager) */}
                  {order.status === 'partially_received' && (
                    <Link href={`/purchase-orders/${order.id}/receive`}>
                      <Button
                        variant="primary"
                        className="w-full"
                        disabled={!canManageInbound}
                        title={!canManageInbound ? 'Requires Admin or Manager role' : 'Receive incoming goods'}
                      >
                        Receive Goods
                      </Button>
                    </Link>
                  )}

                  {!canManageInbound && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center pt-1">
                      Your role ({currentRole}) cannot perform PO actions
                    </p>
                  )}

                  {/* Cancel (Admin, Manager) */}
                  {(order.status === 'draft' || order.status === 'confirmed' || order.status === 'sent') && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={isUpdating || !canManageInbound}
                      title={!canManageInbound ? 'Requires Admin or Manager role' : 'Cancel this Purchase Order'}
                    >
                      Cancel PO
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Send to Supplier Modal ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary-600" />
                  Send Purchase Order
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{order?.po_number}</p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">✕</button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To (Supplier Email)</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="supplier@example.com"
                />
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body <span className="text-gray-400 font-normal">(editable)</span></label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A professionally formatted HTML version of this PO will be sent. The message above is the plain-text reference.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3">
              {/* Send via email */}
              <Button
                variant="primary"
                className="w-full gap-2"
                onClick={handleSendPO}
                disabled={isSendingEmail || !emailTo}
              >
                <Mail className="h-4 w-4" />
                {isSendingEmail ? 'Sending...' : `Send Email to ${emailTo || '...'}`}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Mark as sent without email */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => { await handleStatusChange('sent'); setShowSendModal(false); }}
                disabled={isUpdating}
              >
                Mark as Sent (no email — sent via other channel)
              </Button>

              <button
                onClick={() => setShowSendModal(false)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
