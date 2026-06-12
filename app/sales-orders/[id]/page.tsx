'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Truck, Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getSalesOrderById,
  getSalesOrderItemsWithProducts,
  getCustomers,
  updateSalesOrder,
  autoCreateInvoiceFromSalesOrder,
  updateStockReservation,
} from '@/app/actions';
import { hasPermission, getCurrentUser } from '@/lib/auth-utils';
import { apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import type { SalesOrder, SalesOrderItem, Invoice } from '@/types';

interface Customer {
  id: string;
  name: string;
}

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [canConfirmOrder, setCanConfirmOrder] = useState(false);
  const [canPickShip, setCanPickShip] = useState(false);
  const [currentRole, setCurrentRole] = useState('');

  useEffect(() => {
    setCanConfirmOrder(hasPermission('so:approve') || hasPermission('invoices:write'));
    setCanPickShip(hasPermission('so:fulfill') || hasPermission('inventory:write'));
    setCurrentRole(getCurrentUser()?.role ?? '');
  }, []);

  useEffect(() => {
    loadSalesOrderDetails();
  }, [id]);

  const loadSalesOrderDetails = async () => {
    try {
      setIsLoading(true);
      const [orderResponse, itemsResponse, customersResponse] = await Promise.all([
        getSalesOrderById(id),
        getSalesOrderItemsWithProducts(id),
        getCustomers(),
      ]);

      if (orderResponse.error) {
        toast.error('Failed to load sales order');
        router.back();
        return;
      }

      const orderData = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;
      setOrder(orderData);

      const itemsData = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setItems(itemsData);

      // Create customer map
      if (customersResponse.data && Array.isArray(customersResponse.data)) {
        const customerMap: Record<string, Customer> = {};
        customersResponse.data.forEach((customer: any) => {
          customerMap[customer.id] = customer;
        });
        setCustomers(customerMap);
      }

      // Load linked invoice
      const invoiceResponse = await apiGet<Invoice[]>(
        `${API_ENDPOINTS.INVOICES}?order_id=eq.${id}&order_type=eq.sales_order&limit=1`
      );
      if (!invoiceResponse.error && invoiceResponse.data && Array.isArray(invoiceResponse.data) && invoiceResponse.data.length > 0) {
        setInvoice(invoiceResponse.data[0] || null);
      }
    } catch (error) {
      toast.error('Error loading sales order details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;

    try {
      setIsUpdating(true);
      const result = await updateSalesOrder(order.id, { status: newStatus });

      if (result.error) {
        toast.error('Failed to update sales order status');
        return;
      }

      // ── Auto-reserve inventory when SO is confirmed ──
      if (newStatus === 'confirmed' && items.length > 0) {
        const reservationErrors: string[] = [];
        for (const item of items) {
          if (!item.product_id) continue;
          const qty = parseFloat(String(item.quantity_ordered)) || 0;
          if (qty <= 0) continue;
          // Reserve from the product's default warehouse (set per product in settings)
          const warehouseId = (item as any).product?.warehouse_id as string | undefined;
          const res = await updateStockReservation(item.product_id, qty, warehouseId);
          if (res.error) {
            reservationErrors.push((item as any).product?.name || item.product_id);
          }
        }
        if (reservationErrors.length > 0) {
          toast.warning(`Order confirmed, but reservation failed for: ${reservationErrors.join(', ')}`);
        } else {
          toast.success('Order confirmed and inventory reserved');
        }
      }

      // ── Release reservations when SO is cancelled ──
      else if (newStatus === 'cancelled' && items.length > 0) {
        for (const item of items) {
          if (!item.product_id) continue;
          const qty = parseFloat(String(item.quantity_ordered)) || 0;
          if (qty <= 0) continue;
          const warehouseId = (item as any).product?.warehouse_id as string | undefined;
          await updateStockReservation(item.product_id, -qty, warehouseId);
        }
        toast.success('Order cancelled and reservations released');
      }

      else {
        toast.success(`Order status updated to ${newStatus}`);
      }

      setOrder({ ...order, status: newStatus as any });
    } catch (error) {
      toast.error('Error updating sales order');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading sales order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Sales order not found</p>
      </div>
    );
  }

  const customer = customers[order.customer_id];
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    picked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    partially_shipped: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    shipped: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales-orders">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.so_number}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Created {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
            {order.status.replace('_', ' ').charAt(0).toUpperCase() +
              order.status.replace('_', ' ').slice(1)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Info */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">{customer?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Payment Terms</p>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">{order.payment_terms || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Order Date</p>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">{new Date(order.order_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Expected Delivery</p>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                  {(order as any).expected_delivery_date
                    ? new Date((order as any).expected_delivery_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Actual Delivery</p>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                  {(() => {
                    const date = items.find((i: any) => i.actual_delivery_date)?.actual_delivery_date as string | undefined;
                    return date ? new Date(date).toLocaleDateString() : 'N/A';
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Product</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">Method</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Qty Ordered</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Qty Shipped</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{item.description}</td>
                        <td className="px-4 py-2.5 text-center">
                          {(() => {
                            const m = (item as any).product?.allocation_method;
                            const cfg: Record<string, string> = {
                              FIFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              FEFO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              LIFO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                            };
                            if (!m) return <span className="text-xs text-gray-400 italic">—</span>;
                            return (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg[m] ?? ''}`}>
                                {m}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                          {parseFloat(String(item.quantity_ordered)).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                          {parseFloat(String(item.quantity_shipped)).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                          ₱{parseFloat(String(item.unit_price)).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                          ₱{(parseFloat(String(item.quantity_ordered)) * parseFloat(String(item.unit_price))).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No items in this sales order
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Order Summary */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">₱{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tax</span>
                <span className="font-medium text-gray-900 dark:text-white">₱{order.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Shipping</span>
                <span className="font-medium text-gray-900 dark:text-white">₱{(order.shipping_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-lg font-bold text-primary-600">₱{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Invoice */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Invoice
            </h3>
            {invoice ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <Link href={`/invoices#invoice-${invoice.id}`}>
                    <span className="font-medium text-primary-600 hover:text-primary-700">{invoice.invoice_number}</span>
                  </Link>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : invoice.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {invoice.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">₱{parseFloat(String(invoice.total_amount || 0)).toFixed(2)}</span>
                </div>
                {(invoice.amount_paid || invoice.paid_amount) && parseFloat(String(invoice.amount_paid || invoice.paid_amount || 0)) > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Paid</span>
                    <span className="font-medium text-green-600">₱{parseFloat(String(invoice.amount_paid || invoice.paid_amount || 0)).toFixed(2)}</span>
                  </div>
                )}
                <Link href={`/invoices?id=${invoice.id}`}>
                  <Button variant="secondary" size="sm" className="w-full gap-1.5 mt-1">
                    <FileText className="h-3.5 w-3.5" />
                    View Invoice
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {order?.status === 'delivered'
                  ? 'Invoice will appear here once created'
                  : 'Invoice will be created when order is delivered'}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Quick Actions</h3>

              {/* Role hint */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {order.status === 'draft'
                  ? (canConfirmOrder ? 'Admin / Manager / Sales' : 'Admin, Manager or Sales required')
                  : (canPickShip ? 'Admin / Manager' : 'Admin or Manager required')}
              </p>

              <div className="space-y-2">
                {/* Draft → Confirm & Pick (Admin, Manager, Sales) */}
                {order.status === 'draft' && (
                  <Button
                    variant="primary"
                    className="w-full gap-2"
                    onClick={() => handleStatusChange('confirmed')}
                    disabled={isUpdating || !canConfirmOrder}
                    title={!canConfirmOrder ? 'Requires Admin, Manager or Sales role' : 'Confirm order and begin picking'}
                  >
                    <Package className="h-4 w-4" />
                    Confirm & Pick
                  </Button>
                )}

                {/* Confirmed → Pick Items (Admin, Manager) */}
                {order.status === 'confirmed' && (
                  canPickShip ? (
                    <Link href={`/sales-orders/${order.id}/pick`}>
                      <Button variant="primary" className="w-full gap-2">
                        <Package className="h-4 w-4" />
                        Pick Items
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="primary" className="w-full gap-2" disabled title="Requires Admin or Manager role">
                      <Package className="h-4 w-4" />
                      Pick Items
                    </Button>
                  )
                )}

                {/* Picked → Ship Items (Admin, Manager) */}
                {order.status === 'picked' && (
                  canPickShip ? (
                    <Link href={`/sales-orders/${order.id}/ship`}>
                      <Button variant="primary" className="w-full gap-2">
                        <Truck className="h-4 w-4" />
                        Ship Items
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="primary" className="w-full gap-2" disabled title="Requires Admin or Manager role">
                      <Truck className="h-4 w-4" />
                      Ship Items
                    </Button>
                  )
                )}

                {/* Partially Shipped → Continue Shipping (Admin, Manager) */}
                {order.status === 'partially_shipped' && (
                  canPickShip ? (
                    <Link href={`/sales-orders/${order.id}/ship`}>
                      <Button variant="primary" className="w-full gap-2">
                        <Truck className="h-4 w-4" />
                        Continue Shipping
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="primary" className="w-full gap-2" disabled title="Requires Admin or Manager role">
                      <Truck className="h-4 w-4" />
                      Continue Shipping
                    </Button>
                  )
                )}

                {/* Shipped → Confirm Customer Receipt (Admin, Manager) */}
                {order.status === 'shipped' && (
                  <Button
                    variant="primary"
                    className="w-full gap-2"
                    onClick={async () => {
                      if (!confirm('Confirm that the customer has received the delivery? This will mark the order as Delivered and generate an invoice.')) return;
                      try {
                        setIsUpdating(true);
                        await updateSalesOrder(order.id, { status: 'delivered' });
                        // Pass clientUserId + clientCompanyId as fallback when session cookie is stale
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
                        const invoiceResult = await autoCreateInvoiceFromSalesOrder(order.id, clientUserId, clientCompanyId);
                        if (!invoiceResult.error) {
                          toast.success('Delivery confirmed! Invoice created.');
                        } else {
                          toast.warning(`Delivery confirmed, but invoice creation failed: ${invoiceResult.error}. Please create it manually.`);
                        }
                        await loadSalesOrderDetails();
                      } catch {
                        toast.error('Error confirming delivery');
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                    disabled={isUpdating || !canPickShip}
                    title={!canPickShip ? 'Requires Admin or Manager role' : 'Confirm customer received the delivery'}
                  >
                    <Truck className="h-4 w-4" />
                    Confirm Customer Receipt
                  </Button>
                )}

                {/* Not-authorized note */}
                {(order.status === 'draft' ? !canConfirmOrder : !canPickShip) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center pt-1">
                    Your role ({currentRole}) cannot perform this action
                  </p>
                )}

                {/* Cancel (Admin, Manager, Sales on draft) */}
                {(order.status === 'draft' || order.status === 'confirmed') && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={isUpdating || !canConfirmOrder}
                    title={!canConfirmOrder ? 'Requires Admin, Manager or Sales role' : 'Cancel this order'}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
