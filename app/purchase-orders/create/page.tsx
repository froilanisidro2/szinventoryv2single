'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPurchaseOrder, getSuppliers, getProducts, createPurchaseOrderItem, getUnitOfMeasurements, getMaterialRequestItems, getMaterialRequestById, generatePoNumber } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtSupplier } from '@/lib/warehouse-utils';

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
}

interface POFormData {
  poNumber: string;
  supplierId: string;
  orderDate: string;
  currencyCode: string;
  notes: string;
  taxRate: number;
}

export default function CreatePOPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>}>
      <CreatePOForm />
    </Suspense>
  );
}

function CreatePOForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mrfId = searchParams.get('mrf_id');
  const { selectedWarehouseId } = useWarehouse();
  const [mrfBanner, setMrfBanner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [uomMap, setUomMap] = useState<Record<string, string>>({});
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [skuSearches, setSkuSearches] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({});
  const [paymentTerms, setPaymentTerms] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [supplierVatInfo, setSupplierVatInfo] = useState<{ type: 'vat' | 'non_vat'; rate: number | null } | null>(null);
  const [formData, setFormData] = useState<POFormData>({
    poNumber: '',
    supplierId: '',
    orderDate: (new Date().toISOString().split('T')[0] ?? '') as string,
    currencyCode: 'PHP',
    notes: '',
    taxRate: 0.12,
  });

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersResult, productsResult, unitsResult, poNumberResult] = await Promise.all([
          getSuppliers(),
          getProducts(500),
          getUnitOfMeasurements(),
          generatePoNumber(),
        ]);

        if (!suppliersResult.error && suppliersResult.data) {
          setSuppliers(suppliersResult.data);
        }
        if (!productsResult.error && productsResult.data) {
          setProducts(productsResult.data);
        }
        if (!unitsResult.error && Array.isArray(unitsResult.data)) {
          const map: Record<string, string> = {};
          (unitsResult.data as any[]).forEach((u: any) => {
            map[u.id] = u.abbreviation || u.name || u.id;
          });
          setUomMap(map);
        }
        if (!poNumberResult.error && poNumberResult.data) {
          setFormData(prev => ({ ...prev, poNumber: poNumberResult.data as string }));
        }

        // Pre-fill from MRF if mrf_id param is present
        if (mrfId) {
          const supplierIdParam = new URLSearchParams(window.location.search).get('supplier_id');

          const [mrfRes, mrfItemsRes] = await Promise.all([
            getMaterialRequestById(mrfId),
            getMaterialRequestItems(mrfId),
          ]);
          if (!mrfRes.error && mrfRes.data) {
            setMrfBanner(mrfRes.data.mrf_number);
          }
          if (!mrfItemsRes.error && Array.isArray(mrfItemsRes.data)) {
            const allItems = mrfItemsRes.data.filter((i: any) => i.product_id);

            // Determine which supplier's items to load
            const supplierIds = [...new Set(allItems.map((i: any) => i.product?.supplier_id ?? null))];
            const targetSupplierId = supplierIdParam || (supplierIds.length === 1 ? supplierIds[0] : null);

            if (!targetSupplierId && supplierIds.length > 1) {
              // Multiple suppliers — cannot mix in one PO, redirect back
              setMrfBanner(`⚠ MRF has items from ${supplierIds.length} different suppliers. Use the MRF page to create one PO per supplier.`);
              setLineItems([]);
            } else {
              // Filter to only this supplier's items
              const filtered = targetSupplierId
                ? allItems.filter((i: any) => (i.product?.supplier_id ?? null) === targetSupplierId)
                : allItems;

              const prefilled: LineItem[] = filtered.map((i: any) => ({
                id: Date.now().toString() + Math.random(),
                productId: i.product_id,
                productName: i.product?.name || i.product_id,
                sku: i.product?.sku || '',
                uom: i.product?.unit_of_measure || '',
                quantity: Number(i.quantity_requested),
                unitPrice: Number(i.product?.purchase_price || i.product?.cost_price || 0),
                taxRate: 0,
                discount: 0,
              }));
              setLineItems(prefilled);

              // Auto-select supplier and apply VAT from supplier settings
              if (targetSupplierId) {
                const supplier = (suppliersResult.data as any[]).find((s: any) => s.id === targetSupplierId);
                const vatRate = supplier?.vat_type === 'vat' && supplier?.vat_rate != null
                  ? Number(supplier.vat_rate) / 100
                  : 0;
                setFormData(prev => ({ ...prev, supplierId: targetSupplierId, taxRate: vatRate }));
                if (supplier?.vat_type) {
                  setSupplierVatInfo({ type: supplier.vat_type, rate: supplier.vat_rate ?? null });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtCurrency = (n: number) =>
    `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const resolveUom = (raw: string) => uomMap[raw] || raw || '—';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'supplierId') {
      const supplier = suppliers.find((s: any) => s.id === value);
      if (supplier?.payment_terms) setPaymentTerms(supplier.payment_terms);
      if (supplier?.vat_type) {
        const vatRate = supplier.vat_type === 'vat' && supplier.vat_rate != null
          ? Number(supplier.vat_rate) / 100
          : 0;
        setFormData(prev => ({ ...prev, [name]: value, taxRate: vatRate }));
        setSupplierVatInfo({ type: supplier.vat_type, rate: supplier.vat_rate ?? null });
        return;
      } else {
        setSupplierVatInfo(null);
      }
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
      taxRate: formData.taxRate,
      discount: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (id: string, field: string, value: any) => {
    console.log(`handleLineItemChange: id=${id}, field=${field}, value=${value}`);
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
      (!formData.supplierId || p.supplier_id === formData.supplierId) &&
      (p.sku?.toLowerCase().includes(search) ||
      p.name?.toLowerCase().includes(search))
    ).slice(0, 5);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      toast.error('Please select a supplier');
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

    console.log('All line items validated. Proceeding with PO creation:', lineItems);

    setIsLoading(true);
    try {
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const tax = subtotal * formData.taxRate;
      
      console.log('Creating PO with data:', {
        po_number: formData.poNumber,
        supplier_id: formData.supplierId,
        items_count: lineItems.length,
      });

      const result = await createPurchaseOrder({
        company_id: defaultCompanyId,
        po_number: formData.poNumber,
        supplier_id: formData.supplierId,
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
        ...(selectedWarehouseId ? { warehouse_id: selectedWarehouseId } : {}),
        ...(mrfId ? { mrf_id: mrfId } : {}),
      });

      console.log('PO Creation full response:', result);

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to create purchase order';
        console.error('PO Creation error:', errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      // Extract PO ID - handle both single object and array formats
      let poData = Array.isArray(result.data) ? result.data?.[0] : result.data;
      let poId = poData?.id;
      
      console.log('Raw result.data:', result.data);
      console.log('Extracted poData:', poData);
      console.log('Extracted poId:', poId);
      
      // If still no ID, try alternate field names
      if (!poId && poData) {
        poId = poData?.purchase_order_id || poData?.po_id || Object.values(poData).find(v => typeof v === 'string' && v.length === 36);
        console.log('Using alternate ID extraction:', poId);
      }
      
      if (!poId) {
        console.error('Could not extract PO ID from response:', { result, poData });
        toast.error('Failed to get purchase order ID - please try again');
        setIsLoading(false);
        return;
      }

      console.log('Final PO ID to use:', poId);

      // Create purchase order items
      let itemsCreated = 0;
      let itemsFailed = 0;
      const failedItems: string[] = [];

      for (const item of lineItems) {
        try {
          console.log(`Creating item for product ${item.productId}:`, {
            purchase_order_id: poId,
            product_id: item.productId,
            quantity_ordered: item.quantity,
            unit_price: item.unitPrice,
            tax_rate: item.taxRate,
          });

          const itemResult = await createPurchaseOrderItem({
            purchase_order_id: poId,
            product_id: item.productId,
            description: `${item.sku} - ${item.productName}`,
            quantity_ordered: item.quantity,
            unit_price: item.unitPrice,
            tax_rate: item.taxRate,
            discount_percent: item.discount,
          });

          if (itemResult?.error) {
            console.error(`Error creating PO item for product ${item.productId}:`, itemResult.error);
            itemsFailed++;
            failedItems.push(`${item.productName}: ${itemResult.error?.message || 'Unknown error'}`);
          } else {
            itemsCreated++;
            console.log(`✓ Item created successfully for product ${item.productId}`);
          }
        } catch (itemError) {
          console.error(`Exception creating PO item for product ${item.productId}:`, itemError);
          itemsFailed++;
          failedItems.push(`${item.productName}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
        }
      }

      console.log(`PO items summary: Created=${itemsCreated}, Failed=${itemsFailed}`);

      if (itemsFailed > 0) {
        const failMsg = failedItems.join('\n');
        console.error('Failed items details:\n', failMsg);
        toast.error(`Created PO but ${itemsFailed} items failed:\n${failMsg.substring(0, 100)}...`);
      } else {
        toast.success(`✓ Purchase Order created with ${itemsCreated} items`);
      }

      if (itemsCreated > 0) {
        setTimeout(() => router.push('/purchase-orders'), 500);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error('Failed to create purchase order');
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
          <Link href="/purchase-orders" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Purchase Orders
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Create a new purchase order for suppliers</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 lg:grid lg:grid-cols-4 lg:gap-4">
          {/* PO Details - Compact */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Purchase Order Details</h2>
            {mrfBanner && (
              mrfBanner.startsWith('⚠') ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
                  <span className="flex-shrink-0">⚠</span>
                  <span>{mrfBanner.replace('⚠ ', '')}</span>
                  <Link href={`/material-requests/${mrfId}`} className="ml-auto underline font-semibold whitespace-nowrap">
                    Back to MRF →
                  </Link>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0" />
                  Items pre-filled from approved MRF <span className="font-mono font-semibold">{mrfBanner}</span>. Review and confirm before saving.
                </div>
              )
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">PO Number</label>
                <input
                  type="text"
                  name="poNumber"
                  value={formData.poNumber}
                  readOnly
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier<span className="text-red-500">*</span></label>
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>{fmtSupplier(sup)}</option>
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

            {/* Product Search Box - Visible at top */}
            <div className="relative bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Add Product
              </label>
              <input
                type="text"
                placeholder={formData.supplierId ? "Search by SKU or product name..." : "Select a supplier first to search their products..."}
                disabled={!formData.supplierId}
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
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                          unitPrice: prod.purchase_price || prod.cost_price || 0,
                          taxRate: 0,
                          discount: 0,
                        };
                        setLineItems([...lineItems, newItem]);
                        setSkuSearches(prev => ({ ...prev, 'global': '' }));
                        setShowSuggestions(prev => ({ ...prev, 'global': false }));
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0 cursor-pointer"
                    >
                      <div className="font-medium line-clamp-1">{prod.sku} - {prod.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lineItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-12 flex-1 flex items-center justify-center">No line items added yet</p>
            ) : (
              <div className="overflow-x-auto flex-1 border border-gray-200 dark:border-gray-700 rounded">
                {products.length === 0 && (
                  <div className="mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                      ⚠️ No products loaded. Unable to select products for this PO.
                    </p>
                  </div>
                )}
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
                    {lineItems.map((item) => {
                      console.log(`Rendering line item: ID=${item.id}, productId=${item.productId}, productName=${item.productName}, skuSearch=${skuSearches[item.id]}`);
                      return (
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
                                placeholder={formData.supplierId ? "Search SKU..." : "Select a supplier first..."}
                                disabled={!formData.supplierId}
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
                                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        console.log(`☑️ Clicking product: ${prod.name} (${prod.sku}) for item ${item.id}`);
                                        setLineItems(lineItems.map(li =>
                                          li.id === item.id
                                            ? {
                                                ...li,
                                                productId: prod.id,
                                                productName: prod.name,
                                                sku: prod.sku,
                                                uom: prod.unit_of_measure || '',
                                                unitPrice: prod.purchase_price || prod.cost_price || 0,
                                              }
                                            : li
                                        ));
                                        setSkuSearches(prev => ({ ...prev, [item.id]: prod.sku }));
                                        setShowSuggestions(prev => ({ ...prev, [item.id]: false }));
                                        console.log(`✅ Product selected: ${prod.name} with ID: ${prod.id}`);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-gray-600 last:border-b-0 cursor-pointer bg-white dark:bg-gray-700 border-0"
                                    >
                                      <div className="font-medium line-clamp-1">{prod.sku} - {prod.name}</div>
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
                          <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {resolveUom(item.uom)}
                          </span>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-auto">
              <div className="flex justify-end">
                <div className="w-72">
                  <div className="flex justify-between py-1.5 text-sm items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      Tax (%):
                      {supplierVatInfo && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          supplierVatInfo.type === 'vat'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {supplierVatInfo.type === 'vat' ? 'VAT' : 'Non-VAT'}
                        </span>
                      )}
                    </span>
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
            <Link href="/purchase-orders">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
