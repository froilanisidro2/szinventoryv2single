'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, FileText, User, Calendar, Eye, Truck, Package, CheckCircle, Download, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import type { SalesOrder } from '@/types';
import { getSalesOrders, getCustomers, updateSalesOrder, getSalesOrderItems, getSalesOrderItemsWithProducts, updateStockReservation, autoCreateInvoiceFromSalesOrder } from '@/app/actions';
import { sendSalesOrderEmail } from '@/app/actions/email';
import { toast } from 'sonner';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import { useWarehouse } from '@/contexts/warehouse-context';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  picked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  partially_shipped: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  shipped: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    draft: 'New',
    confirmed: 'Approved',
    picked: 'Picked',
    partially_shipped: 'Shipped',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return statusLabels[status] || status;
};

export default function SalesOrdersPage(): React.ReactElement {
  const { selectedWarehouseId, warehouses } = useWarehouse();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; orderId: string; newStatus: string; orderSO: string }>({ isOpen: false, orderId: '', newStatus: '', orderSO: '' });
  const [sendModal, setSendModal] = useState<{ isOpen: boolean; order: SalesOrder | null }>({ isOpen: false, order: null });
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sendModalItems, setSendModalItems] = useState<any[]>([]);

  useEffect(() => {
    loadSalesOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const loadSalesOrders = async () => {
    try {
      setIsLoading(true);
      const wh = selectedWarehouseId || undefined;
      const [ordersResponse, customersResponse] = await Promise.all([
        getSalesOrders(100, 0, wh),
        getCustomers(),
      ]);

      if (ordersResponse.error) {
        toast.error('Failed to load sales orders');
        return;
      }

      setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);

      if (customersResponse.data && Array.isArray(customersResponse.data)) {
        const customerMap: Record<string, string> = {};
        customersResponse.data.forEach((customer: any) => {
          customerMap[customer.id] = customer.name;
        });
        setCustomers(customerMap);
      }
    } catch (error) {
      toast.error('Error loading sales orders');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = orders.filter((order) => {
    const matchStatus = statusFilter ? order.status === statusFilter : true;
    const matchSearch = order.so_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customers[order.customer_id]?.toLowerCase().includes(searchTerm.toLowerCase());
    const orderDate = new Date(order.order_date);
    const matchFrom = dateFrom ? orderDate >= new Date(dateFrom) : true;
    const matchTo = dateTo ? orderDate <= new Date(dateTo) : true;
    return matchStatus && matchSearch && matchFrom && matchTo;
  });

  const fmtAmt = (n: number) => `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = filtered.slice(startIndex, startIndex + pageSize);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const downloadCSV = () => {
    const headers = ['SO Number', 'Customer', 'Order Date', 'Status', 'Total Amount'];
    const rows = filtered.map(o => [
      o.so_number,
      customers[o.customer_id] || '',
      new Date(o.order_date).toLocaleDateString('en-PH'),
      getStatusLabel(o.status),
      Number(o.total_amount).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSendModal = async (order: SalesOrder) => {
    const customerObj = Object.entries(customers).find(([id]) => id === order.customer_id);
    const customerName = customerObj?.[1] || 'Customer';
    let customerEmail = '';
    let companyName = 'Our Company';
    try {
      const allCustomers = await getCustomers();
      const found = (allCustomers.data as any[])?.find((c: any) => c.id === order.customer_id);
      customerEmail = found?.email || '';
    } catch {}
    try { companyName = JSON.parse(localStorage.getItem('company') || '{}').name || companyName; } catch {}

    const itemsRes = await getSalesOrderItems(order.id);
    const soItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    setSendModalItems(soItems);

    const fmt = (n: number) => `₱ ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const itemLines = soItems.map((item: any, i: number) =>
      `  ${i + 1}. ${item.description || 'Item'} — Qty: ${item.quantity_ordered}, Unit Price: ${fmt(item.unit_price)}, Total: ${fmt(Number(item.quantity_ordered) * Number(item.unit_price))}`
    ).join('\n');

    setEmailTo(customerEmail);
    setEmailSubject(`Sales Order ${order.so_number} from ${companyName}`);
    setEmailBody(`Dear ${customerName},

Thank you for your order. Please find below the details:

SO Number: ${order.so_number}
Order Date: ${new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
${order.payment_terms ? `Payment Terms: ${order.payment_terms}` : ''}

LINE ITEMS:
${itemLines}

Subtotal: ${fmt(Number(order.subtotal))}
Tax: ${fmt(Number(order.tax_amount))}
Total Amount: ${fmt(Number(order.total_amount))}
${order.notes ? `\nNotes: ${order.notes}` : ''}

Please don't hesitate to contact us if you have any questions.

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
      try { const c = JSON.parse(localStorage.getItem('company') || '{}'); companyName = c.name || companyName; companyEmail = c.email; } catch {}
      const customerName = customers[order.customer_id] || 'Customer';

      const result = await sendSalesOrderEmail({
        customerEmail: emailTo,
        customerName,
        companyName, companyEmail,
        soNumber: order.so_number,
        orderId: order.id,
        orderDate: new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        paymentTerms: order.payment_terms,
        notes: order.notes,
        items: sendModalItems.map((item: any) => ({
          productName: item.description || 'Item',
          quantity: Number(item.quantity_ordered),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.quantity_ordered) * Number(item.unit_price),
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.tax_amount),
        shippingCost: Number(order.shipping_cost || 0),
        totalAmount: Number(order.total_amount),
      });

      if (!result.success) { toast.error(result.error || 'Failed to send email'); return; }
      setSendModal({ isOpen: false, order: null });
      toast.success(`SO confirmation emailed to ${emailTo}`);
    } catch { toast.error('Failed to send email'); }
    finally { setIsSendingEmail(false); }
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    const order = orders.find((o) => o.id === orderId);
    setConfirmModal({ isOpen: true, orderId, newStatus, orderSO: order?.so_number || '' });
  };

  const handleConfirmDelivery = async (orderId: string) => {
    try {
      setUpdatingOrders((prev) => new Set(prev).add(orderId));
      const result = await updateSalesOrder(orderId, { status: 'delivered' });
      if (result.error) {
        toast.error('Failed to confirm delivery');
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'delivered' as any } : o)));

      // Auto-create sales invoice on delivery confirmation
      let clientUserId: string | undefined;
      let clientCompanyId: string | undefined;
      try {
        const raw = sessionStorage.getItem('user') ?? localStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw);
          clientUserId = parsed?.id;
          clientCompanyId = parsed?.companyId;
        }
      } catch { /* ignore */ }
      const invoiceResult = await autoCreateInvoiceFromSalesOrder(orderId, clientUserId, clientCompanyId);
      if (invoiceResult.error) {
        toast.success('Customer receipt confirmed — SO marked as Delivered');
        toast.warning(`Invoice could not be auto-created: ${invoiceResult.error}. Please create it manually.`);
      } else {
        toast.success('Customer receipt confirmed — SO marked as Delivered & Invoice created');
      }
    } catch {
      toast.error('Error confirming delivery');
    } finally {
      setUpdatingOrders((prev) => {
        const updated = new Set(prev);
        updated.delete(orderId);
        return updated;
      });
    }
  };

  const confirmStatusChange = async () => {
    const { orderId, newStatus } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });
    try {
      setUpdatingOrders((prev) => new Set(prev).add(orderId));
      const result = await updateSalesOrder(orderId, { status: newStatus });
      if (result.error) {
        toast.error('Failed to update SO status');
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o)));

      // ── Auto-reserve inventory when approved ──
      if (newStatus === 'confirmed') {
        const itemsRes = await getSalesOrderItemsWithProducts(orderId);
        const soItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        for (const item of soItems) {
          if (!item.product_id) continue;
          const qty = parseFloat(String(item.quantity_ordered)) || 0;
          if (qty <= 0) continue;
          const warehouseId = (item as any).product?.warehouse_id as string | undefined;
          await updateStockReservation(item.product_id, qty, warehouseId);
        }
        toast.success('Order approved and inventory reserved');
      }
      // ── Release reservations when cancelled ──
      else if (newStatus === 'cancelled') {
        const itemsRes = await getSalesOrderItemsWithProducts(orderId);
        const soItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        for (const item of soItems) {
          if (!item.product_id) continue;
          const qty = parseFloat(String(item.quantity_ordered)) || 0;
          if (qty <= 0) continue;
          const warehouseId = (item as any).product?.warehouse_id as string | undefined;
          await updateStockReservation(item.product_id, -qty, warehouseId);
        }
        toast.success('Order cancelled and reservations released');
      }
      else {
        toast.success(`SO status updated to ${getStatusLabel(newStatus)}`);
      }
    } catch {
      toast.error('Error updating SO status');
    } finally {
      setUpdatingOrders((prev) => {
        const updated = new Set(prev);
        updated.delete(orderId);
        return updated;
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWarehouseId && warehouses.length > 0
              ? `📦 ${fmtWarehouse(warehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · ${orders.length} orders`
              : `Manage customer sales orders (${orders.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={downloadCSV}>
            CSV
          </Button>
          <Link href="/sales-orders/create">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Create SO
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by SO number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 text-sm" />
          <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 text-sm" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-400 hover:text-red-500 px-2">Clear</button>
          )}
        </div>
        <select
          value={statusFilter || ''}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white bg-white text-gray-900 min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="draft">New</option>
          <option value="confirmed">Approved</option>
          <option value="picked">Picked</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Loading sales orders...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Stats */}
          {(dateFrom || dateTo) && (
            <p className="text-xs text-primary-600 dark:text-primary-400">
              Showing stats for {dateFrom || '…'} → {dateTo || '…'} &nbsp;({filtered.length} SO{filtered.length !== 1 ? 's' : ''})
            </p>
          )}
          <div className="flex gap-4 items-start">
          {/* Sales Orders Table */}
          <div className="flex-1 min-w-0 card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">SO Number</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Order Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{order.so_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-900 dark:text-white">
                            {customers[order.customer_id] || 'Unknown Customer'}
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
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status as keyof typeof statusColors]}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
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
                            <Link href={`/sales-orders/${order.id}/pick`}>
                              <Button variant="primary" size="sm" className="gap-1">
                                <Package className="h-4 w-4" />
                                Pick
                              </Button>
                            </Link>
                          )}
                          {(order.status === 'picked' || order.status === 'partially_shipped') && (
                            <Link href={`/sales-orders/${order.id}/ship`}>
                              <Button variant="primary" size="sm" className="gap-1">
                                <Truck className="h-4 w-4" />
                                Ship
                              </Button>
                            </Link>
                          )}
                          {order.status === 'partially_shipped' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                              onClick={() => handleConfirmDelivery(order.id)}
                              disabled={updatingOrders.has(order.id)}
                              title="Mark as delivered — customer has received the goods"
                            >
                              <CheckCircle className="h-4 w-4" />
                              {updatingOrders.has(order.id) ? '...' : 'Confirm Receipt'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                            onClick={() => openSendModal(order)}
                            title="Send SO confirmation to customer"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Link href={`/sales-orders/${order.id}`} className="inline-flex">
                            <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10">
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>

            {/* Summary */}
            <div className="w-52 shrink-0 card p-4 sticky top-4 self-start">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total SOs</span>
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
                  <span className="text-sm text-gray-600 dark:text-gray-400">Picked</span>
                  <span className="text-sm font-semibold text-orange-600">{filtered.filter((o) => o.status === 'picked').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Shipped</span>
                  <span className="text-sm font-semibold text-red-600">{filtered.filter((o) => o.status === 'shipped' || o.status === 'partially_shipped').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Delivered</span>
                  <span className="text-sm font-semibold text-green-600">{filtered.filter((o) => o.status === 'delivered').length}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Pending</p>
                  <p className="text-sm font-bold text-orange-600">
                    {fmtAmt(filtered.filter((o) => ['draft','confirmed','picked','partially_shipped','shipped'].includes(o.status)).reduce((sum, o) => sum + Number(o.total_amount), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Delivered</p>
                  <p className="text-sm font-bold text-green-600">
                    {fmtAmt(filtered.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total_amount), 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No sales orders found</p>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title="Confirm Action"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to change SO <strong>{confirmModal.orderSO}</strong> status to <strong>{getStatusLabel(confirmModal.newStatus)}</strong>?
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmStatusChange}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send SO Email Modal */}
      {sendModal.isOpen && sendModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary-600" />
                  Send Sales Order to Customer
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{sendModal.order.so_number}</p>
              </div>
              <button onClick={() => setSendModal({ isOpen: false, order: null })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To (Customer Email)</label>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="customer@example.com" />
                {!emailTo && <p className="text-xs text-amber-600 mt-1">No email on file — enter manually or update the customer record.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body <span className="text-gray-400 font-normal">(editable)</span></label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={12}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A formatted HTML email with all SO details and a <strong>View &amp; Print SO</strong> button will be sent to the customer.
              </p>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <Button variant="primary" className="w-full gap-2" onClick={handleSendEmail} disabled={isSendingEmail || !emailTo}>
                <Mail className="h-4 w-4" />
                {isSendingEmail ? 'Sending...' : `Send Email to ${emailTo || '...'}`}
              </Button>
              <button onClick={() => setSendModal({ isOpen: false, order: null })}
                className="block w-full text-sm text-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

