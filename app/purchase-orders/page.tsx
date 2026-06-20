'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, FileText, Truck, Calendar, Eye, Package, FileCheck, CheckCircle, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import type { PurchaseOrder } from '@/types';
import { getPurchaseOrders, getSuppliers, updatePurchaseOrder, getPurchaseOrderItems } from '@/app/actions';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import { sendPurchaseOrderEmail } from '@/app/actions/email';
import { Mail } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import { toast } from 'sonner';
import { useWarehouse } from '@/contexts/warehouse-context';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  partially_received: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

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

export default function PurchaseOrdersPage(): React.ReactElement {
  const router = useRouter();
  const { selectedWarehouseId, warehouses } = useWarehouse();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [_grnMap, setGrnMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sendModal, setSendModal] = useState<{ isOpen: boolean; order: PurchaseOrder | null }>({ isOpen: false, order: null });
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendModalItems, setSendModalItems] = useState<any[]>([]);

  useEffect(() => {
    loadPurchaseOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const loadPurchaseOrders = async () => {
    try {
      setIsLoading(true);
      const wh = selectedWarehouseId || undefined;
      const [ordersResponse, suppliersResponse] = await Promise.all([
        getPurchaseOrders(100, 0, wh),
        getSuppliers(),
      ]);

      if (ordersResponse.error) {
        toast.error('Failed to load purchase orders');
        return;
      }

      const ordersList = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
      setOrders(ordersList);

      // Create supplier map
      if (suppliersResponse.data && Array.isArray(suppliersResponse.data)) {
        const supplierMap: Record<string, string> = {};
        suppliersResponse.data.forEach((supplier: any) => {
          supplierMap[supplier.id] = supplier.name;
        });
        setSuppliers(supplierMap);
      }

      // Fetch GRN only for fully-received POs
      const grnMapLocal: Record<string, any> = {};
      for (const order of ordersList) {
        if (order.status === 'received') {
          try {
            const grnResponse = await apiGet<any[]>(
              `${API_ENDPOINTS.GRN}?purchase_order_id=eq.${order.id}&limit=1`
            );
            if (!grnResponse.error && Array.isArray(grnResponse.data) && grnResponse.data.length > 0) {
              grnMapLocal[order.id] = grnResponse.data[0];
            }
          } catch {
            // silently skip — GRN is optional
          }
        }
      }
      setGrnMap(grnMapLocal);
    } catch (error) {
      toast.error('Error loading purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = orders.filter((order) => {
    const matchStatus = statusFilter ? order.status === statusFilter : true;
    const matchSearch = order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      suppliers[order.supplier_id]?.toLowerCase().includes(searchTerm.toLowerCase());
    const orderDate = new Date(order.order_date);
    const matchFrom = dateFrom ? orderDate >= new Date(dateFrom) : true;
    const matchTo = dateTo ? orderDate <= new Date(dateTo) : true;
    return matchStatus && matchSearch && matchFrom && matchTo;
  });

  const fmtAmt = (n: number) => `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrders(prev => new Set(prev).add(orderId));
      const result = await updatePurchaseOrder(orderId, { status: newStatus });

      if (result.error) {
        toast.error('Failed to update PO status');
        return;
      }

      setOrders(orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus as any } : order
      ));

      toast.success(`PO status updated to ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error('Error updating PO status');
    } finally {
      setUpdatingOrders(prev => {
        const updated = new Set(prev);
        updated.delete(orderId);
        return updated;
      });
    }
  };

  const handleReceiveClick = (order: PurchaseOrder) => {
    router.push(`/purchase-orders/${order.id}/receive`);
  };

  const downloadCSV = () => {
    const headers = ['PO Number', 'Supplier', 'Order Date', 'Status', 'Total Amount'];
    const rows = filtered.map(o => [
      o.po_number,
      suppliers[o.supplier_id] || '',
      new Date(o.order_date).toLocaleDateString('en-PH'),
      getStatusLabel(o.status),
      Number(o.total_amount).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSendModal = async (order: PurchaseOrder) => {
    const supplierName = suppliers[order.supplier_id] || 'Supplier';
    const supplierObj = (await getSuppliers()).data?.find((s: any) => s.id === order.supplier_id) as any;
    const supplierEmail = supplierObj?.email || '';

    let companyName = 'Our Company';
    try { companyName = JSON.parse(localStorage.getItem('company') || '{}').name || companyName; } catch {}

    // Load items
    const itemsRes = await getPurchaseOrderItems(order.id);
    const poItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    setSendModalItems(poItems);

    const fmt = (n: number) => `₱ ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const itemLines = poItems.map((item: any, i: number) =>
      `  ${i + 1}. ${item.description || 'Item'} — Qty: ${item.quantity_ordered}, Unit Price: ${fmt(item.unit_price)}, Total: ${fmt(Number(item.quantity_ordered) * Number(item.unit_price))}`
    ).join('\n');

    setEmailTo(supplierEmail);
    setEmailSubject(`Purchase Order ${order.po_number} from ${companyName}`);
    setEmailBody(`Dear ${supplierObj?.contact_person || supplierName},

Please find below our Purchase Order details:

PO Number: ${order.po_number}
Order Date: ${new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
${order.payment_terms ? `Payment Terms: ${order.payment_terms}` : ''}

LINE ITEMS:
${itemLines}

Subtotal: ${fmt(Number(order.subtotal))}
Tax: ${fmt(Number(order.tax_amount))}
Total Amount: ${fmt(Number(order.total_amount))}
${order.notes ? `\nNotes: ${order.notes}` : ''}

Please confirm receipt of this Purchase Order at your earliest convenience.

Best regards,
${companyName}`);

    setSendModal({ isOpen: true, order });
  };

  const handleSendEmail = async () => {
    const order = sendModal.order;
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

      const supplierObj = (await getSuppliers()).data?.find((s: any) => s.id === order.supplier_id) as any;

      const result = await sendPurchaseOrderEmail({
        supplierEmail: emailTo,
        supplierName: supplierObj?.contact_person || supplierObj?.name || 'Supplier',
        companyName, companyEmail,
        poNumber: order.po_number,
        orderDate: new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        paymentTerms: order.payment_terms,
        notes: order.notes,
        items: sendModalItems.map((item: any) => ({
          productName: item.description || 'Item',
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

      if (!result.success) { toast.error(result.error || 'Failed to send email'); return; }

      // Update status to sent
      await updatePurchaseOrder(order.id, { status: 'sent' });
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'sent' as any } : o));
      setSendModal({ isOpen: false, order: null });
      toast.success(`PO emailed to ${emailTo} and marked as Sent`);
    } catch (err) {
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleMarkAsSent = async () => {
    const order = sendModal.order;
    if (!order) return;
    await updatePurchaseOrder(order.id, { status: 'sent' });
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'sent' as any } : o));
    setSendModal({ isOpen: false, order: null });
    toast.success('PO marked as Sent');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWarehouseId && warehouses.length > 0
              ? `📦 ${fmtWarehouse(warehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · ${orders.length} orders`
              : `Manage supplier purchase orders (${orders.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={downloadCSV}>
            CSV
          </Button>
          
            <Button href="/purchase-orders/create" variant="primary" icon={<Plus className="h-4 w-4" />}>
              Create PO
            </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by PO number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 text-sm"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 text-sm"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter || ''}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="draft">New</option>
          <option value="confirmed">Approved</option>
          <option value="sent">Sent</option>
          <option value="partially_received">Confirmed</option>
          <option value="received">Received</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Loading purchase orders...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
      {(dateFrom || dateTo) && (
        <p className="text-xs text-primary-600 dark:text-primary-400">
          Showing stats for {dateFrom || '…'} → {dateTo || '…'} &nbsp;({filtered.length} PO{filtered.length !== 1 ? 's' : ''})
        </p>
      )}

      <div className="flex gap-4 items-start">
        {/* Purchase Orders Table */}
        <div className="flex-1 min-w-0 card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Order Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {order.po_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">
                        {suppliers[order.supplier_id] || 'Unknown Supplier'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      {new Date(order.order_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    ₱{order.total_amount.toLocaleString('en-PH')}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        statusColors[order.status as keyof typeof statusColors]
                      }`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Status-specific actions */}
                      {order.status === 'draft' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'confirmed')}
                          disabled={updatingOrders.has(order.id)}
                          className="gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                      )}
                      {order.status === 'confirmed' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openSendModal(order)}
                          disabled={updatingOrders.has(order.id)}
                          className="gap-1"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </Button>
                      )}
                      {order.status === 'sent' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'partially_received')}
                          disabled={updatingOrders.has(order.id)}
                          className="gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Confirm
                        </Button>
                      )}
                      {order.status === 'partially_received' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReceiveClick(order)}
                          disabled={updatingOrders.has(order.id)}
                          className="gap-1"
                        >
                          <Package className="h-4 w-4" />
                          Receive
                        </Button>
                      )}
                      {/* GRN — only show after PO is fully received */}
                      {order.status === 'received' && (
                        <Button href={`/purchase-orders/${order.id}/grn`} className="inline-flex text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 gap-1" variant="ghost" size="sm">
                            <FileCheck className="h-4 w-4" />
                            GRN
                          </Button>
                      )}
                      {/* View Details */}
                      <Button href={`/purchase-orders/${order.id}`} className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10" variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
        </div>

        {/* Summary Card */}
        <div className="w-52 shrink-0 card p-4 sticky top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total POs</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{filtered.length}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">New</span>
              <span className="text-sm font-semibold text-gray-500">{filtered.filter((o) => o.status === 'draft').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Approved</span>
              <span className="text-sm font-semibold text-purple-600">{filtered.filter((o) => o.status === 'confirmed').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sent</span>
              <span className="text-sm font-semibold text-blue-600">{filtered.filter((o) => o.status === 'sent').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Confirmed</span>
              <span className="text-sm font-semibold text-orange-600">{filtered.filter((o) => o.status === 'partially_received').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Received</span>
              <span className="text-sm font-semibold text-green-600">{filtered.filter((o) => o.status === 'received').length}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Pending</p>
              <p className="text-sm font-bold text-orange-600">
                {fmtAmt(filtered.filter((o) => ['draft','confirmed','sent','partially_received'].includes(o.status)).reduce((sum, o) => sum + Number(o.total_amount), 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Received</p>
              <p className="text-sm font-bold text-green-600">
                {fmtAmt(filtered.filter((o) => o.status === 'received').reduce((sum, o) => sum + Number(o.total_amount), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No purchase orders found</p>
        </div>
      )}
        </>
      )}


      {/* Send to Supplier Modal */}
      {sendModal.isOpen && sendModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary-600" />
                  Send Purchase Order
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{sendModal.order.po_number}</p>
              </div>
              <button onClick={() => setSendModal({ isOpen: false, order: null })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">✕</button>
            </div>

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
                {!emailTo && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No email on file for this supplier — enter manually or update the supplier record.</p>}
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
              <p className="text-xs text-gray-500 dark:text-gray-400">A formatted HTML email with full PO details will be sent. The body above is the plain-text reference.</p>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <Button
                variant="primary"
                className="w-full gap-2"
                onClick={handleSendEmail}
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

              <Button variant="secondary" className="w-full" onClick={handleMarkAsSent} disabled={isSendingEmail}>
                Mark as Sent (sent via phone, WhatsApp, fax, etc.)
              </Button>

              <button
                onClick={() => setSendModal({ isOpen: false, order: null })}
                className="block w-full text-sm text-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
