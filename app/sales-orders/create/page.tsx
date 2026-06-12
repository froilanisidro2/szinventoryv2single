'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createSalesOrder, getCustomers, getProducts, createSalesOrderItem, getUnitOfMeasurements } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  warehouseId?: string;
  binLocationId?: string;
}

interface SOFormData {
  soNumber: string;
  customerId: string;
  orderDate: string;
  currencyCode: string;
  notes: string;
  taxRate: number;
}

export default function CreateSOPage() {
  const router = useRouter();
  const { selectedWarehouseId } = useWarehouse();
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [uomMap, setUomMap] = useState<Record<string, string>>({});
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [skuSearches, setSkuSearches] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [paymentTerms, setPaymentTerms] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [formData, setFormData] = useState<SOFormData>({
    soNumber: `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`,
    customerId: '',
    orderDate: (new Date().toISOString().split('T')[0] ?? '') as string,
    currencyCode: 'PHP',
    notes: '',
    taxRate: 0.12,
  });

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersResult, productsResult, uomResult] = await Promise.all([
          getCustomers(),
          getProducts(),
          getUnitOfMeasurements(),
        ]);

        if (!customersResult.error && customersResult.data) {
          setCustomers(customersResult.data);
        }
        if (!productsResult.error && productsResult.data) {
          setProducts(productsResult.data);
        }
        if (!uomResult.error && uomResult.data) {
          const map: Record<string, string> = {};
          for (const u of uomResult.data) {
            map[u.id] = u.name || u.abbreviation || u.symbol || u.id;
          }
          setUomMap(map);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  const fmtCurrency = (n: number) =>
    `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'customerId') {
      const customer = customers.find((c: any) => c.id === value);
      if (customer?.payment_terms) setPaymentTerms(customer.payment_terms);
    }
  };

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      productId: '',
      productName: '',
      sku: '',
      uom: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0.1,
      discount: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (id: string, field: string, value: any) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const getMatchingProducts = (skuSearch: string) => {
    if (!skuSearch.trim()) return [];
    const search = skuSearch.toLowerCase();
    return products.filter((p: any) => 
      p.sku?.toLowerCase().includes(search) || 
      p.name?.toLowerCase().includes(search)
    ).slice(0, 5);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error('Please select a customer');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    // Validate all line items
    for (const item of lineItems) {
      if (!item.productId) {
        console.error(`Validation failed: Item ${item.id} has no productId. Current state:`, item);
        toast.error('Please select a product for all line items');
        return;
      }
      if (item.quantity <= 0) {
        toast.error('All quantities must be greater than 0');
        return;
      }
    }

    setIsLoading(true);
    try {
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tax = subtotal * formData.taxRate;

      // Derive allocation method from product settings — FEFO takes priority (expiry-critical)
      const productMethods = lineItems
        .map(item => products.find((p: any) => p.id === item.productId)?.allocation_method)
        .filter(Boolean) as string[];
      const allocationMethod = productMethods.includes('FEFO')
        ? 'FEFO'
        : productMethods.includes('LIFO')
        ? 'LIFO'
        : productMethods.includes('FIFO')
        ? 'FIFO'
        : undefined;

      const result = await createSalesOrder({
        company_id: defaultCompanyId,
        so_number: formData.soNumber,
        customer_id: formData.customerId,
        order_date: formData.orderDate,
        expected_delivery_date: expectedDeliveryDate || undefined,
        status: 'draft',
        subtotal: subtotal,
        tax_amount: tax,
        shipping_cost: shippingCost,
        total_amount: subtotal + tax + shippingCost,
        currency_code: formData.currencyCode,
        payment_terms: paymentTerms,
        notes: formData.notes,
        ...(allocationMethod ? { allocation_method: allocationMethod } : {}),
        ...(selectedWarehouseId ? { warehouse_id: selectedWarehouseId } : {}),
      });

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to create sales order';
        console.error('SO Creation error:', errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      const soData = Array.isArray(result.data) ? result.data?.[0] : result.data;
      let soId = soData?.id;

      if (!soId) {
        console.error('Could not extract SO ID from response:', { result, soData });
        toast.error('Failed to get sales order ID - please try again');
        setIsLoading(false);
        return;
      }

      // Create sales order items
      let itemsCreated = 0;
      let itemsFailed = 0;
      const failedItems: string[] = [];

      for (const item of lineItems) {
        try {
          const itemResult = await createSalesOrderItem({
            sales_order_id: soId,
            product_id: item.productId,
            description: `${item.sku} - ${item.productName}`,
            quantity_ordered: item.quantity,
            unit_price: item.unitPrice,
            tax_rate: item.taxRate,
            discount_percent: item.discount,
            warehouse_id: item.warehouseId,
            bin_location_id: item.binLocationId,
          });

          if (itemResult?.error) {
            itemsFailed++;
            failedItems.push(`${item.productName}: ${itemResult.error?.message || 'Unknown error'}`);
          } else {
            itemsCreated++;
          }
        } catch (itemError) {
          itemsFailed++;
          failedItems.push(`${item.productName}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        }
      }

      if (itemsFailed > 0) {
        const failMsg = failedItems.join('\n');
        toast.error(`Created SO but ${itemsFailed} items failed:\n${failMsg.substring(0, 100)}...`);
      } else {
        toast.success('Sales order created successfully with all items');
      }

      router.push('/sales-orders');
    } catch (error) {
      console.error('Error creating sales order:', error);
      toast.error('Error creating sales order');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * formData.taxRate;
    return { subtotal, tax, total: subtotal + tax + shippingCost };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/sales-orders" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Sales Orders
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Sales Order</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Create a new sales order for a customer</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 lg:grid lg:grid-cols-4 lg:gap-4">
          {/* SO Details - Compact */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sales Order Details</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SO Number</label>
                <input
                  type="text"
                  name="soNumber"
                  value={formData.soNumber}
                  readOnly
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer<span className="text-red-500">*</span></label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Order Date<span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="orderDate"
                  value={formData.orderDate}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., Net 30"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  min={formData.orderDate}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Shipping Fee (₱)</label>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Line Items - Full Width */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col space-y-3 lg:min-h-96">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Line Items</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddLineItem}
              >
                Add Item
              </Button>
            </div>

            {/* Quick Add Product Search */}
            <div className="relative bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Add Product
              </label>
              <input
                type="text"
                placeholder="Search by SKU or product name..."
                onFocus={(e) => {
                  if (e.target.value.length > 0) {
                    setShowSuggestions(prev => ({ ...prev, 'global': true }));
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, 'global': false })), 200)}
                onChange={(e) => {
                  const value = e.target.value;
                  setSkuSearches(prev => ({ ...prev, 'global': value }));
                  setShowSuggestions(prev => ({ ...prev, 'global': value.length > 0 }));
                }}
                value={skuSearches['global'] || ''}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {showSuggestions['global'] && skuSearches['global'] && getMatchingProducts(skuSearches['global'] || '').length > 0 && (
                <div className="absolute z-10 w-full mt-1 left-0 right-0 mx-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                  {getMatchingProducts(skuSearches['global'] || '').map((prod: any) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newItem: LineItem = {
                          id: Date.now().toString(),
                          productId: prod.id,
                          productName: prod.name,
                          sku: prod.sku,
                          uom: prod.unit_of_measure || '',
                          quantity: 1,
                          unitPrice: prod.selling_price || prod.cost_price || 0,
                          taxRate: formData.taxRate,
                          discount: 0,
                        };
                        setLineItems(prev => [...prev, newItem]);
                        setSkuSearches(prev => ({ ...prev, 'global': '' }));
                        setShowSuggestions(prev => ({ ...prev, 'global': false }));
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0 cursor-pointer"
                    >
                      <div className="font-medium">{prod.sku}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{prod.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lineItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-12 flex-1 flex items-center justify-center">No line items added yet</p>
            ) : (
              <div className="overflow-x-auto flex-1 border border-gray-200 dark:border-gray-700 rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Product</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Qty</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-20">UOM</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">Unit Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">Line Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-3 relative">
                          {item.productId ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 dark:text-white font-medium line-clamp-1">
                                {item.sku && item.productName ? `${item.sku} - ${item.productName}` : item.productName || item.sku}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLineItemChange(item.id, 'productId', '');
                                  handleLineItemChange(item.id, 'sku', '');
                                  setSkuSearches(prev => ({ ...prev, [item.id]: '' }));
                                }}
                                className="text-xs px-2 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 whitespace-nowrap"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search SKU..."
                                value={skuSearches[item.id] || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSkuSearches(prev => ({ ...prev, [item.id]: value }));
                                  setShowSuggestions(prev => ({ ...prev, [item.id]: value.length > 0 }));
                                }}
                                onFocus={() => {
                                  if (skuSearches[item.id]) {
                                    setShowSuggestions(prev => ({ ...prev, [item.id]: true }));
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => setShowSuggestions(prev => ({ ...prev, [item.id]: false })), 200);
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                              {showSuggestions[item.id] && skuSearches[item.id] && getMatchingProducts(skuSearches[item.id] || '').length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                                  {getMatchingProducts(skuSearches[item.id] || '').map((prod: any) => (
                                    <button
                                      key={prod.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setLineItems(lineItems.map(li =>
                                          li.id === item.id
                                            ? {
                                                ...li,
                                                productId: prod.id,
                                                productName: prod.name,
                                                sku: prod.sku,
                                                uom: prod.unit_of_measure || '',
                                                unitPrice: prod.selling_price || prod.cost_price || 0,
                                                warehouseId: prod.warehouse_id,
                                                binLocationId: prod.bin_location_id,
                                              }
                                            : li
                                        ));
                                        setSkuSearches(prev => ({ ...prev, [item.id]: prod.sku }));
                                        setShowSuggestions(prev => ({ ...prev, [item.id]: false }));
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0 cursor-pointer bg-white dark:bg-gray-700 border-0"
                                    >
                                      <div className="font-medium">{prod.sku}</div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{prod.name}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            min="1"
                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full text-right"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.uom ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                              {uomMap[item.uom] || item.uom}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-full text-right"
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white text-sm">
                          {fmtCurrency(item.quantity * item.unitPrice)}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-lg font-bold"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-auto">
              <div className="flex justify-end">
                <div className="w-72">
                  <div className="flex justify-between py-1.5 text-sm items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Adjust Tax (%):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      max="100"
                      onChange={(e) => {
                        const taxRate = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, taxRate: taxRate / 100 }));
                      }}
                      value={(formData.taxRate * 100).toFixed(1)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                    />
                  </div>
                  <div className="flex justify-between py-1.5 text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="font-medium">{fmtCurrency(calculateTotal().subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax ({(formData.taxRate * 100).toFixed(0)}%):</span>
                    <span className="font-medium">{fmtCurrency(calculateTotal().tax)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Shipping:</span>
                    <span className="font-medium">{fmtCurrency(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-base border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">{fmtCurrency(calculateTotal().total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="lg:col-span-4 flex justify-end gap-3">
            <Link href="/sales-orders">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Sales Order'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
