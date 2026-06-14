'use server';

import { apiGet, apiPost, apiPatch, apiDelete, apiUpsert } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-endpoints';
import { Product, Customer, Supplier, Invoice, GRN } from '@/types';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { signSession, verifySession } from '@/lib/session';

// ============= HELPER FUNCTIONS =============

/**
 * Get the current user's company ID from session
 * This ensures all data operations are scoped to the user's company
 */
function getVerifiedSession(): Record<string, any> | null {
  try {
    const token = cookies().get('user')?.value;
    if (!token) return null;
    // Try signed token first (new format)
    const verified = verifySession(token);
    if (verified) return verified as Record<string, any>;
    // Fall back to unsigned JSON for sessions created before signing was added
    return JSON.parse(token);
  } catch {
    return null;
  }
}

function getCurrentUserId(): string | null {
  return getVerifiedSession()?.id ?? null;
}

function getCurrentUserCompanyId(): string {
  const user = getVerifiedSession();
  return user?.companyId || process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || '';
}

// ============= PRODUCTS =============

export async function getProducts(limit = 100, offset = 0, warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.PRODUCTS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (warehouseId && warehouseId !== 'all') url += `&warehouse_id=eq.${warehouseId}`;
  const response = await apiGet<Product[]>(url);
  
  if (response.error) return response;
  
  // Force complete serialization - convert to JSON string and back
  // This ensures no Date objects or other non-serializable types
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as Product[],
    error: null,
  };
}

export async function getProductBySku(sku: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Product[]>(
    `${API_ENDPOINTS.PRODUCTS}?sku=eq.${encodeURIComponent(sku)}&company_id=eq.${companyId}&deleted_at=is.null&limit=1`
  );
  if (response.error) return { data: null, error: response.error };
  const list = Array.isArray(response.data) ? response.data : [];
  return { data: list[0] ?? null, error: null };
}

export async function getProductById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Product>(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}&company_id=eq.${companyId}`);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & { company_id?: string }) {
  try {
    // Prefer the verified session cookie; fall back to the company_id passed in the payload
    // (which the client reads from localStorage — a safe fallback for stale sessions)
    const cookieCompanyId = getCurrentUserCompanyId();
    const companyId = cookieCompanyId || (product as any).company_id || '';
    const productWithCompany = {
      ...product,
      company_id: companyId,
    };
    const response = await apiPost<Product>(API_ENDPOINTS.PRODUCTS, productWithCompany);
    if (response.error) return response;
    return {
      data: JSON.parse(JSON.stringify(response.data)),
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Create product error:', err.message);
    return {
      data: null,
      error: { message: err.message },
    };
  }
}

/**
 * Upsert a product — inserts if the SKU doesn't exist for this company,
 * updates (merges) if it does. Safe to use during bulk import.
 */
export async function upsertProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & { company_id?: string }) {
  try {
    const cookieCompanyId = getCurrentUserCompanyId();
    const companyId = cookieCompanyId || (product as any).company_id || '';
    // Re-importing a SKU that was previously soft-deleted should restore it.
    const payload = { ...product, company_id: companyId, deleted_at: null };
    const response = await apiUpsert<Product>(API_ENDPOINTS.PRODUCTS, payload, 'company_id,sku');
    if (response.error) return response;
    return {
      data: JSON.parse(JSON.stringify(response.data)),
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { data: null, error: { message: err.message } };
  }
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'created_at'>>
) {
  try {
    const companyId = getCurrentUserCompanyId();
    const response = await apiPatch<Product>(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
    if (response.error) return response;
    return {
      data: JSON.parse(JSON.stringify(response.data)),
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Update product error:', err.message);
    return {
      data: null,
      error: { message: err.message },
    };
  }
}

export async function deleteProduct(id: string) {
  const companyId = getCurrentUserCompanyId();
  // Soft delete: products referenced by material requests, stock transactions, etc.
  // can't be hard-deleted due to FK constraints.
  return apiPatch<Product>(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}&company_id=eq.${companyId}`, {
    deleted_at: new Date().toISOString(),
  });
}

// ============= CUSTOMERS =============

export async function getCustomers(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Customer[]>(`${API_ENDPOINTS.CUSTOMERS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as Customer[],
    error: null,
  };
}

export async function getCustomerById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Customer>(`${API_ENDPOINTS.CUSTOMERS}?id=eq.${id}&company_id=eq.${companyId}`);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'company_id'>) {
  const companyId = getCurrentUserCompanyId();
  
  const customerWithCompany = {
    ...customer,
    company_id: companyId,
  };
  
  const response = await apiPost<Customer>(API_ENDPOINTS.CUSTOMERS, customerWithCompany);
  
  if (response.error) {
    console.error('[CREATE_CUSTOMER] API Error:', response.error);
    return response;
  }
  
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, 'id' | 'created_at'>>
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<Customer>(`${API_ENDPOINTS.CUSTOMERS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteCustomer(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.CUSTOMERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= SUPPLIERS =============

export async function getSuppliers(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Supplier[]>(`${API_ENDPOINTS.SUPPLIERS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as Supplier[],
    error: null,
  };
}

export async function getSupplierById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<Supplier>(`${API_ENDPOINTS.SUPPLIERS}?id=eq.${id}&company_id=eq.${companyId}`);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
  const companyId = getCurrentUserCompanyId();
  const supplierWithCompany = {
    ...supplier,
    company_id: companyId,
  };
  const response = await apiPost<Supplier>(API_ENDPOINTS.SUPPLIERS, supplierWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateSupplier(
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'created_at'>>
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<Supplier>(`${API_ENDPOINTS.SUPPLIERS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteSupplier(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.SUPPLIERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= INVOICES =============

export async function getInvoices(limit = 100, offset = 0, warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.INVOICES}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`;
  // Use OR filter: show invoices for the selected warehouse AND invoices with no warehouse set
  // (auto-created invoices from SO/PO confirmation may not have warehouse_id)
  if (warehouseId && warehouseId !== 'all') url += `&or=(warehouse_id.eq.${warehouseId},warehouse_id.is.null)`;
  return apiGet<Invoice[]>(url);
}

export async function getInvoiceById(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<Invoice>(`${API_ENDPOINTS.INVOICES}?id=eq.${id}&company_id=eq.${companyId}`);
}

export async function getInvoicesByType(orderType: 'sales_order' | 'purchase_order', limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<Invoice[]>(
    `${API_ENDPOINTS.INVOICES}?company_id=eq.${companyId}&order_type=eq.${orderType}&order=created_at.desc&limit=${limit}&offset=${offset}`
  );
}

export async function getInvoicesByStatus(status: string, limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<Invoice[]>(
    `${API_ENDPOINTS.INVOICES}?company_id=eq.${companyId}&status=eq.${status}&order=created_at.desc&limit=${limit}&offset=${offset}`
  );
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>, clientUserId?: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId() || clientUserId || null;
  return apiPost<Invoice>(API_ENDPOINTS.INVOICES, {
    ...invoice,
    company_id: companyId,
    ...(userId ? { issued_by_id: userId } : {}),
  });
}

export async function createInvoiceFromOrder(
  orderType: 'sales_order' | 'purchase_order',
  orderId: string,
  invoiceData: Record<string, any>
) {
  const invoice = {
    ...invoiceData,
    order_type: orderType,
    order_id: orderId,
    status: orderType === 'sales_order' ? 'pending' : 'draft',
  };
  return apiPost<Invoice>(API_ENDPOINTS.INVOICES, invoice);
}

export async function updateInvoice(
  id: string,
  updates: Partial<Omit<Invoice, 'id' | 'createdAt'>>
) {
  return apiPatch<Invoice>(`${API_ENDPOINTS.INVOICES}?id=eq.${id}`, updates);
}

export async function updateInvoiceStatus(id: string, status: string) {
  return apiPatch<Invoice>(`${API_ENDPOINTS.INVOICES}?id=eq.${id}`, { status });
}

export async function deleteInvoice(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.INVOICES}?id=eq.${id}&company_id=eq.${companyId}`);
}

/**
 * Auto-generate invoice when Sales Order is shipped
 * Creates a draft invoice with SO details
 */
export async function autoCreateInvoiceFromSalesOrder(
  salesOrderId: string,
  clientUserId?: string,
  clientCompanyId?: string
) {
  try {
    // Resolve company: session cookie first, then client-supplied fallback, then env default
    const companyId = getCurrentUserCompanyId() || clientCompanyId || process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || '';
    if (!companyId) return { error: 'Could not resolve company ID' };

    // Get SO details — query without company_id filter so it works even when cookie is stale
    const soResult = await apiGet<any[]>(
      `${API_ENDPOINTS.SALES_ORDERS}?id=eq.${salesOrderId}`
    );
    if (soResult.error || !Array.isArray(soResult.data) || soResult.data.length === 0) {
      return { error: 'Failed to fetch sales order' };
    }
    const so = soResult.data[0];

    // Check if invoice already exists for this SO
    const existingInvoiceResult = await apiGet<Invoice[]>(
      `${API_ENDPOINTS.INVOICES}?order_id=eq.${salesOrderId}&order_type=eq.sales_order&deleted_at=is.null`
    );
    if (
      !existingInvoiceResult.error &&
      Array.isArray(existingInvoiceResult.data) &&
      existingInvoiceResult.data.length > 0
    ) {
      return { data: 'Invoice already exists for this sales order', error: null };
    }

    // Resolve issued_by_id: session → clientUserId fallback → first company user
    let userId = getCurrentUserId() || clientUserId || null;
    if (!userId) {
      const usersResult = await apiGet<any[]>(
        `${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&deleted_at=is.null&limit=1`
      );
      userId = Array.isArray(usersResult.data) ? usersResult.data[0]?.id : null;
    }
    if (!userId) {
      return { error: 'Could not resolve a user for issued_by_id' };
    }

    // Get SO items to find the actual delivery date + warehouse
    const soItemsResult = await apiGet<any[]>(
      `${API_ENDPOINTS.SALES_ORDER_ITEMS}?sales_order_id=eq.${salesOrderId}&order=actual_delivery_date.desc&limit=1`
    );
    const firstItem =
      Array.isArray(soItemsResult.data) && soItemsResult.data.length > 0
        ? soItemsResult.data[0]
        : null;
    const latestDeliveryDate = firstItem?.actual_delivery_date
      ? firstItem.actual_delivery_date.split('T')[0]
      : null;

    // Resolve warehouse_id from SO or its items
    const warehouseId =
      so.warehouse_id ||
      firstItem?.warehouse_id ||
      null;

    // Build invoice payload — use exact sales_orders column names
    const invoiceNumber = `INV-${Date.now()}`;
    // due_date = expected_delivery_date from SO, or fallback to 30 days from now
    const dueDate = so.expected_delivery_date
      ? so.expected_delivery_date.split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const invoice: Record<string, any> = {
      company_id: companyId,
      invoice_number: invoiceNumber,
      customer_id: so.customer_id,
      issued_by_id: userId,
      order_type: 'sales_order',
      order_id: salesOrderId,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      status: 'pending',
      subtotal: Number(so.subtotal) || 0,
      tax_amount: Number(so.tax_amount) || 0,
      discount_amount: 0,           // sales_orders has no discount column
      total_amount: Number(so.total_amount) || 0,
      amount_paid: 0,
      notes: so.notes || '',
      payment_terms: so.payment_terms || 'Net 30',
    };
    if (latestDeliveryDate) invoice.delivery_date = latestDeliveryDate;
    if (warehouseId) invoice.warehouse_id = warehouseId;

    const result = await apiPost<Invoice>(API_ENDPOINTS.INVOICES, invoice);
    return result;
  } catch (error) {
    console.error('[AUTO-INVOICE] Error auto-creating invoice from sales order:', error);
    return { error: 'Failed to create invoice from sales order' };
  }
}

/**
 * Auto-generate invoice when Purchase Order is received
 * Creates a draft invoice with PO details
 */
export async function autoCreateInvoiceFromPurchaseOrder(purchaseOrderId: string) {
  try {
    const companyId = getCurrentUserCompanyId();
    
    // Get PO details
    const poResult = await apiGet<any>(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${purchaseOrderId}`);
    
    if (poResult.error || !poResult.data) {
      console.error('[AUTO-INVOICE] Failed to fetch PO:', poResult.error);
      return { error: 'Failed to fetch purchase order' };
    }

    const po = poResult.data;

    // Check if invoice already exists for this PO
    const existingInvoiceResult = await apiGet<Invoice[]>(
      `${API_ENDPOINTS.INVOICES}?order_id=eq.${purchaseOrderId}&order_type=eq.purchase_order`
    );
    
    
    if (!existingInvoiceResult.error && existingInvoiceResult.data?.length > 0) {
      return { data: 'Invoice already exists for this purchase order', error: null };
    }

    // Get a user ID for issued_by_id (get first user in system)
    const usersResult = await apiGet<any>(`${API_ENDPOINTS.USERS}?limit=1`);
    
    if (usersResult.error || !usersResult.data || usersResult.data.length === 0) {
      console.error('[AUTO-INVOICE] No users found in system');
      return { error: 'No users found in system to assign invoice' };
    }
    
    const userId = usersResult.data[0]?.id;
    
    // Create invoice with correct database column names
    const invoiceNumber = `INV-PO-${Date.now()}`;
    const invoice = {
      company_id: companyId,
      invoice_number: invoiceNumber,
      supplier_id: po.supplier_id,
      issued_by_id: userId,
      order_type: 'purchase_order',
      order_id: purchaseOrderId,
      issue_date: new Date().toISOString().split('T')[0], // Use issue_date, format as DATE
      due_date: po.due_date ? po.due_date.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      subtotal: po.subtotal || 0,
      tax_amount: po.tax_total || 0,  // Renamed: tax_total -> tax_amount
      discount_amount: po.discount_total || 0,  // Renamed: discount_total -> discount_amount
      total_amount: po.total || 0,  // Renamed: total -> total_amount
      amount_paid: 0,  // Renamed: paid_amount -> amount_paid
      notes: po.notes || '',
      payment_terms: po.terms || 'Net 30',  // Renamed: terms -> payment_terms
    };

    const result = await apiPost<Invoice>(API_ENDPOINTS.INVOICES, invoice);
    
    return result;
  } catch (error) {
    console.error('[AUTO-INVOICE] Error auto-creating invoice from purchase order:', error);
    return { error: 'Failed to create invoice from purchase order' };
  }
}

/**
 * Fetch the GRN (if any) for a given purchase order
 */
export async function getGRNByPurchaseOrderId(purchaseOrderId: string) {
  return apiGet<GRN[]>(`${API_ENDPOINTS.GRN}?purchase_order_id=eq.${purchaseOrderId}&limit=1`);
}

/**
 * Fetch a purchase order's expected delivery date
 */
export async function getPurchaseOrderExpectedDeliveryDate(purchaseOrderId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${purchaseOrderId}&select=expected_delivery_date&limit=1`);
}

/**
 * Auto-generate GRN when Purchase Order items are fully received
 * Creates a draft GRN with receipt details
 */
export async function autoCreateGRNFromPurchaseOrder(purchaseOrderId: string, _receivedItems: Record<string, any>) {
  try {
    const companyId = getCurrentUserCompanyId();
    
    // Get PO details
    const poResult = await apiGet<any>(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${purchaseOrderId}`);
    
    if (poResult.error || !poResult.data) {
      console.error('[AUTO-GRN] Failed to fetch PO:', poResult.error);
      return { error: 'Failed to fetch purchase order' };
    }

    const po = Array.isArray(poResult.data) ? poResult.data[0] : poResult.data;

    if (!po || !po.supplier_id) {
      console.error('[AUTO-GRN] PO or supplier_id missing');
      return { error: 'Purchase order or supplier not found' };
    }

    // Check if GRN already exists for this PO
    const existingGRNResult = await apiGet<GRN[]>(
      `${API_ENDPOINTS.GRN}?purchase_order_id=eq.${purchaseOrderId}`
    );
    
    
    if (!existingGRNResult.error && existingGRNResult.data?.length > 0) {
      return { data: 'GRN already exists for this purchase order', error: null };
    }

    // Get current user ID scoped to this company
    let userId = null;
    try {
      const usersResult = await apiGet<any>(`${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&limit=1`);
      if (!usersResult.error && usersResult.data && usersResult.data.length > 0) {
        userId = usersResult.data[0]?.id;
      }
    } catch {
      // received_by_id is optional — continue without it
    }

    // Get PO items to calculate totals
    const poItemsResult = await apiGet<any[]>(`${API_ENDPOINTS.PURCHASE_ORDER_ITEMS}?purchase_order_id=eq.${purchaseOrderId}`);
    const poItems = Array.isArray(poItemsResult.data) ? poItemsResult.data : [];
    
    // Calculate totals from the PO items' persisted received/accepted/rejected quantities.
    // (Not from `receivedItems`, since callers key that map differently — by PO item id
    // in some flows and by product id in others.)
    let totalOrdered = 0, totalReceived = 0, totalAccepted = 0, totalRejected = 0;

    poItems.forEach((item: any) => {
      totalOrdered += parseFloat(String(item.quantity_ordered)) || 0;
      totalReceived += parseFloat(String(item.quantity_received)) || 0;
      totalAccepted += parseFloat(String(item.quantity_accepted)) || 0;
      totalRejected += parseFloat(String(item.quantity_rejected)) || 0;
    });

    // Create GRN
    const grnNumber = `GRN-${Date.now()}`;
    const grn: any = {
      company_id: companyId,
      grn_number: grnNumber,
      purchase_order_id: purchaseOrderId,
      supplier_id: po.supplier_id,
      receipt_date: new Date().toISOString().split('T')[0],
      total_items_ordered: totalOrdered,
      total_items_received: totalReceived,
      total_items_accepted: totalAccepted,
      total_items_rejected: totalRejected,
      quality_status: totalRejected > 0 ? 'partial' : 'good',
      status: 'draft',
    };

    // Only add received_by_id if user exists
    if (userId) {
      grn.received_by_id = userId;
    }

    const result = await apiPost<GRN>(API_ENDPOINTS.GRN, grn);
    if (result.error) {
      console.error('[AUTO-GRN] GRN creation failed:', JSON.stringify(result.error));
    } else {
    }
    return result;
  } catch (error) {
    console.error('[AUTO-GRN] Error auto-creating GRN from purchase order:', error);
    return { error: 'Failed to create GRN from purchase order' };
  }
}

// ============= PURCHASE ORDERS =============

export async function getPurchaseOrders(limit = 100, offset = 0, warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.PURCHASE_ORDERS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (warehouseId && warehouseId !== 'all') url += `&warehouse_id=eq.${warehouseId}`;
  return apiGet<any[]>(url);
}

// Returns a map of supplier_id -> number of purchase orders raised for that supplier.
export async function getPurchaseOrderCountsBySupplier() {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(
    `${API_ENDPOINTS.PURCHASE_ORDERS}?company_id=eq.${companyId}&select=supplier_id`
  );

  const counts: Record<string, number> = {};
  if (Array.isArray(response.data)) {
    for (const row of response.data) {
      if (!row.supplier_id) continue;
      counts[row.supplier_id] = (counts[row.supplier_id] || 0) + 1;
    }
  }
  return { data: counts, error: response.error };
}

// Generates the next sequential document number in the format PREFIX-yymmdd-0001
async function generateDailyDocNumber(endpoint: string, column: string, prefix: string, companyId: string | null) {
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const base = `${prefix}-${datePart}-`;

  const res = await apiGet<any[]>(
    `${endpoint}?company_id=eq.${companyId}&${column}=like.${base}*&select=${column}&order=${column}.desc&limit=1`
  );

  let nextSeq = 1;
  const arr = Array.isArray(res.data) ? res.data : [];
  const last = arr[0]?.[column] as string | undefined;
  const match = last?.match(/-(\d{4})$/);
  if (match?.[1]) nextSeq = parseInt(match[1], 10) + 1;

  return `${base}${String(nextSeq).padStart(4, '0')}`;
}

// Generates the next sequential PO number in the format PO-yymmdd-0001
export async function generatePoNumber() {
  const companyId = getCurrentUserCompanyId();
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `PO-${datePart}-`;

  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.PURCHASE_ORDERS}?company_id=eq.${companyId}&po_number=like.${prefix}*&select=po_number&order=po_number.desc&limit=1`
  );

  let nextSeq = 1;
  const arr = Array.isArray(res.data) ? res.data : [];
  const last = arr[0]?.po_number as string | undefined;
  const match = last?.match(/-(\d{4})$/);
  if (match?.[1]) nextSeq = parseInt(match[1], 10) + 1;

  return { data: `${prefix}${String(nextSeq).padStart(4, '0')}`, error: null };
}

export async function getPurchaseOrderById(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any>(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

export async function getPurchaseOrdersByMrfId(mrfId: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.PURCHASE_ORDERS}?company_id=eq.${companyId}&mrf_id=eq.${mrfId}&order=created_at.asc`);
}

export async function createPurchaseOrder(po: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const poWithCompany = {
    ...po,
    company_id: companyId,
  };
  return apiPost<any>(API_ENDPOINTS.PURCHASE_ORDERS, poWithCompany);
}

export async function updatePurchaseOrder(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  return apiPatch<any>(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
}

export async function deletePurchaseOrder(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

export async function getPurchaseOrderItems(purchaseOrderId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.PURCHASE_ORDER_ITEMS}?purchase_order_id=eq.${purchaseOrderId}`);
}

export async function getPurchaseOrderItemsWithProducts(purchaseOrderId: string) {
  // Fetch PO items first
  const itemsResponse = await getPurchaseOrderItems(purchaseOrderId);
  if (itemsResponse.error || !itemsResponse.data) {
    return itemsResponse;
  }

  const items = Array.isArray(itemsResponse.data) ? itemsResponse.data : [itemsResponse.data];

  // Fetch all products to enrich items
  const productsResponse = await getProducts(1000, 0);
  if (productsResponse.error || !productsResponse.data) {
    // If we can't get products, just return items as-is
    return { data: items, error: null };
  }

  const products = Array.isArray(productsResponse.data) ? productsResponse.data : [productsResponse.data];
  const productMap = new Map(products.map((p: any) => [p.id, p]));

  // Enrich items with product data
  const enrichedItems = items.map((item: any) => ({
    ...item,
    product: productMap.get(item.product_id),
  }));

  return { data: enrichedItems, error: null };
}

export async function createPurchaseOrderItem(item: Record<string, unknown>) {
  return apiPost<any>(API_ENDPOINTS.PURCHASE_ORDER_ITEMS, item);
}

export async function updatePurchaseOrderItem(id: string, updates: Record<string, unknown>) {
  return apiPatch<any>(`${API_ENDPOINTS.PURCHASE_ORDER_ITEMS}?id=eq.${id}`, updates);
}

// ============= SALES ORDERS =============

export async function getSalesOrders(limit = 100, offset = 0, warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.SALES_ORDERS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (warehouseId && warehouseId !== 'all') url += `&warehouse_id=eq.${warehouseId}`;
  return apiGet<any[]>(url);
}

export async function getSalesOrderById(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any>(`${API_ENDPOINTS.SALES_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

export async function createSalesOrder(so: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const soWithCompany = {
    ...so,
    company_id: companyId,
  };
  return apiPost<any>(API_ENDPOINTS.SALES_ORDERS, soWithCompany);
}

export async function updateSalesOrder(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  return apiPatch<any>(`${API_ENDPOINTS.SALES_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
}

export async function getSalesOrderItems(salesOrderId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.SALES_ORDER_ITEMS}?sales_order_id=eq.${salesOrderId}`);
}

export async function getSalesOrderItemsWithProducts(salesOrderId: string) {
  // Fetch SO items first
  const itemsResponse = await getSalesOrderItems(salesOrderId);
  if (itemsResponse.error || !itemsResponse.data) {
    return itemsResponse;
  }

  const items = Array.isArray(itemsResponse.data) ? itemsResponse.data : [itemsResponse.data];

  // Fetch all products to enrich items
  const productsResponse = await getProducts(1000, 0);
  if (productsResponse.error || !productsResponse.data) {
    // If we can't get products, just return items as-is
    return { data: items, error: null };
  }

  const products = Array.isArray(productsResponse.data) ? productsResponse.data : [productsResponse.data];
  const productMap = new Map(products.map((p: any) => [p.id, p]));

  // Enrich items with product data
  const enrichedItems = items.map((item: any) => ({
    ...item,
    product: productMap.get(item.product_id),
  }));

  return { data: enrichedItems, error: null };
}

export async function createSalesOrderItem(item: Record<string, unknown>) {
  return apiPost<any>(API_ENDPOINTS.SALES_ORDER_ITEMS, item);
}

export async function updateSalesOrderItem(id: string, updates: Record<string, unknown>) {
  return apiPatch<any>(`${API_ENDPOINTS.SALES_ORDER_ITEMS}?id=eq.${id}`, updates);
}

// ============= STOCK TRANSFERS =============

export async function getStockTransfers(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.STOCK_TRANSFERS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`);
}

export async function getStockTransfersWithDetails(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const [transfersRes, warehousesRes] = await Promise.all([
    apiGet<any[]>(`${API_ENDPOINTS.STOCK_TRANSFERS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`),
    apiGet<any[]>(`${API_ENDPOINTS.WAREHOUSES}?company_id=eq.${companyId}`),
  ]);
  if (transfersRes.error) return transfersRes;
  const transfers = Array.isArray(transfersRes.data) ? transfersRes.data : [];
  const whMap: Record<string, any> = {};
  if (Array.isArray(warehousesRes.data)) {
    warehousesRes.data.forEach((w: any) => { whMap[w.id] = w; });
  }
  const enriched = transfers.map((t: any) => ({
    ...t,
    from_warehouse_name: whMap[t.from_warehouse_id]?.name || '—',
    to_warehouse_name: whMap[t.to_warehouse_id]?.name || '—',
  }));
  return { data: enriched, error: null };
}

export async function getStockTransferById(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any>(`${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

export async function getStockTransferItems(transferId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.STOCK_TRANSFER_ITEMS}?stock_transfer_id=eq.${transferId}`);
}

export async function createStockTransfer(transfer: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  return apiPost<any>(API_ENDPOINTS.STOCK_TRANSFERS, { ...transfer, company_id: companyId });
}

export async function createStockTransferItems(items: Record<string, unknown>[]) {
  return apiPost<any>(API_ENDPOINTS.STOCK_TRANSFER_ITEMS, items);
}

export async function updateStockTransfer(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  return apiPatch<any>(`${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
}

export async function cancelStockTransfer(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiPatch<any>(`${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${id}&company_id=eq.${companyId}`, { status: 'cancelled' });
}

export async function completeStockTransfer(transferId: string) {
  const companyId = getCurrentUserCompanyId();

  const transferRes = await apiGet<any[]>(
    `${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${transferId}`
  );
  if (transferRes.error || !Array.isArray(transferRes.data) || !transferRes.data[0]) {
    return { data: null, error: { message: 'Transfer not found' } };
  }
  const transfer = transferRes.data[0];
  const fromWarehouseId = transfer.from_warehouse_id;
  const toWarehouseId   = transfer.to_warehouse_id;
  const resolvedCompanyId = companyId || transfer.company_id;

  const itemsRes = await apiGet<any[]>(
    `${API_ENDPOINTS.STOCK_TRANSFER_ITEMS}?stock_transfer_id=eq.${transferId}`
  );
  if (itemsRes.error || !Array.isArray(itemsRes.data) || itemsRes.data.length === 0) {
    return { data: null, error: { message: 'No items found for this transfer' } };
  }
  const items = itemsRes.data;

  const errors: string[] = [];

  for (const item of items) {
    const fromBinId = item.from_bin_id || transfer.from_bin_id;
    const toBinId   = item.to_bin_id   || transfer.to_bin_id;
    // Quantity — coerce to integer for bin_stock (integer column)
    const qty    = parseFloat(String(item.quantity_requested)) || 0;
    const qtyInt = Math.round(qty);

    if (!qty || !item.product_id) {
      errors.push(`Item skipped: missing product or quantity`);
      continue;
    }

    // ── Bin-level operations (skip gracefully if bins not configured) ──
    if (fromBinId) {
      const srcRes = await apiGet<any[]>(
        `${API_ENDPOINTS.BIN_STOCK}?bin_location_id=eq.${fromBinId}&product_id=eq.${item.product_id}&company_id=eq.${resolvedCompanyId}`
      );
      const srcBin = Array.isArray(srcRes.data) ? srcRes.data[0] : null;

      // Validate source bin stock (warn but don't hard-fail if missing)
      if (srcBin && srcBin.quantity < qtyInt) {
        errors.push(`Low bin stock for ${item.product_id}: bin has ${srcBin.quantity}, transferring ${qtyInt} anyway`);
      }

      if (srcBin) {
        // Deduct from source bin
        const newSrcQty = Math.max(0, srcBin.quantity - qtyInt);
        await apiPatch<any>(`${API_ENDPOINTS.BIN_STOCK}?id=eq.${srcBin.id}`, { quantity: newSrcQty });
        // Keep bin_locations.current_quantity in sync
        await apiPatch<any>(
          `${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${fromBinId}`,
          { current_quantity: Math.max(0, (srcBin.quantity || 0) - qtyInt) }
        );
      }

      if (toBinId) {
        const dstRes = await apiGet<any[]>(
          `${API_ENDPOINTS.BIN_STOCK}?bin_location_id=eq.${toBinId}&product_id=eq.${item.product_id}&company_id=eq.${resolvedCompanyId}`
        );
        const dstBin = Array.isArray(dstRes.data) ? dstRes.data[0] : null;
        if (dstBin) {
          await apiPatch<any>(`${API_ENDPOINTS.BIN_STOCK}?id=eq.${dstBin.id}`, { quantity: dstBin.quantity + qtyInt });
          await apiPatch<any>(`${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${toBinId}`, { current_quantity: (dstBin.quantity || 0) + qtyInt });
        } else {
          await apiPost<any>(API_ENDPOINTS.BIN_STOCK, {
            bin_location_id: toBinId,
            product_id: item.product_id,
            company_id: resolvedCompanyId,
            quantity: qtyInt,
            allocated_quantity: 0,
          });
          await apiPatch<any>(`${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${toBinId}`, { current_quantity: qtyInt });
        }
      }
    }

    // ── stock_levels: deduct from source warehouse ──
    if (fromWarehouseId) {
      const srcLevelRes = await apiGet<any[]>(
        `${API_ENDPOINTS.STOCK_LEVELS}?company_id=eq.${resolvedCompanyId}&product_id=eq.${item.product_id}&warehouse_id=eq.${fromWarehouseId}`
      );
      const srcLevel = Array.isArray(srcLevelRes.data) ? srcLevelRes.data[0] : null;
      if (srcLevel) {
        await apiPatch<any>(`${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${srcLevel.id}`, {
          quantity_on_hand: Math.max(0, (srcLevel.quantity_on_hand || 0) - qtyInt),
        });
      }
      // Note: if no stock_levels row exists for source, nothing to deduct
    }

    // ── stock_levels: increment destination warehouse (create row if needed) ──
    if (toWarehouseId) {
      const dstLevelRes = await apiGet<any[]>(
        `${API_ENDPOINTS.STOCK_LEVELS}?company_id=eq.${resolvedCompanyId}&product_id=eq.${item.product_id}&warehouse_id=eq.${toWarehouseId}`
      );
      const dstLevel = Array.isArray(dstLevelRes.data) ? dstLevelRes.data[0] : null;
      if (dstLevel) {
        await apiPatch<any>(`${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${dstLevel.id}`, {
          quantity_on_hand: (dstLevel.quantity_on_hand || 0) + qtyInt,
        });
      } else {
        await apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
          company_id: resolvedCompanyId,
          product_id: item.product_id,
          warehouse_id: toWarehouseId,
          quantity_on_hand: qtyInt,
          quantity_allocated: 0,
          quantity_rejected: 0,
        });
      }
    }

    // ── Mark item received ──
    await apiPatch<any>(`${API_ENDPOINTS.STOCK_TRANSFER_ITEMS}?id=eq.${item.id}`, {
      quantity_received: qtyInt,
    });

    // ── Audit trail (2 transactions: out + in) ──
    await createStockTransaction({
      product_id: item.product_id,
      transaction_type: 'out',
      quantity: qtyInt,
      reference_type: 'stock_transfer',
      reference_id: transferId,
      warehouse_id: fromWarehouseId || undefined,
      notes: `${transfer.transfer_number}: dispatched from source warehouse`,
    });
    await createStockTransaction({
      product_id: item.product_id,
      transaction_type: 'in',
      quantity: qtyInt,
      reference_type: 'stock_transfer',
      reference_id: transferId,
      warehouse_id: toWarehouseId || undefined,
      notes: `${transfer.transfer_number}: received at destination warehouse`,
    });
  }

  // Mark transfer as received
  const updateRes = await apiPatch<any>(
    `${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${transferId}`,
    {
      status: 'received',
      received_date: new Date().toISOString().split('T')[0], // date only
    }
  );

  if (errors.length > 0 && errors.length === items.length) {
    return { data: null, error: { message: errors.join('; ') } };
  }
  return errors.length > 0
    ? { data: updateRes.data, error: { message: `Completed with warnings: ${errors.join('; ')}` } }
    : { data: updateRes.data, error: null };
}

export async function deleteStockTransfer(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.STOCK_TRANSFERS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= WAREHOUSES =============

export async function getWarehouses(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.WAREHOUSES}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

/**
 * Returns only the warehouses the current user is allowed to see.
 * If the user has no warehouse assignments → returns all company warehouses.
 * If the user has assignments → returns only those warehouses.
 *
 * @param clientUserId  Optional user ID from client-side storage (fallback when
 *                      the session cookie can't be verified, e.g. stale session).
 */
export async function getAccessibleWarehouses(clientUserId?: string): Promise<{ data: any[]; error: any }> {
  const companyId = getCurrentUserCompanyId();
  // Prefer the verified cookie userId; fall back to the client-supplied one
  const userId = getCurrentUserId() ?? clientUserId ?? null;

  // Get all company warehouses first
  const allRes = await apiGet<any[]>(
    `${API_ENDPOINTS.WAREHOUSES}?company_id=eq.${companyId}&order=created_at.desc`
  );
  if (allRes.error) return { data: [], error: allRes.error };
  const all: any[] = Array.isArray(allRes.data) ? allRes.data : [];

  // No user resolved → fall back to all
  if (!userId) return { data: JSON.parse(JSON.stringify(all)), error: null };

  // Get this user's warehouse assignments
  const assignRes = await apiGet<{ warehouse_id: string }[]>(
    `${API_ENDPOINTS.USER_WAREHOUSES}?user_id=eq.${userId}&company_id=eq.${companyId}&select=warehouse_id`
  );
  if (assignRes.error) return { data: JSON.parse(JSON.stringify(all)), error: null };

  const assigned: string[] = Array.isArray(assignRes.data)
    ? assignRes.data.map((r) => r.warehouse_id)
    : [];

  // No assignments → access to all warehouses
  if (assigned.length === 0) return { data: JSON.parse(JSON.stringify(all)), error: null };

  // Filter to only assigned warehouses, preserving original order
  const filtered = all.filter((w) => assigned.includes(w.id));
  return { data: JSON.parse(JSON.stringify(filtered)), error: null };
}

export async function getWarehouseById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any>(`${API_ENDPOINTS.WAREHOUSES}?id=eq.${id}&company_id=eq.${companyId}`);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function createWarehouse(warehouse: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
  const companyId = getCurrentUserCompanyId();
  const warehouseWithCompany = {
    ...warehouse,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.WAREHOUSES, warehouseWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateWarehouse(
  id: string,
  updates: Partial<Omit<any, 'id' | 'created_at'>>
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.WAREHOUSES}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteWarehouse(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.WAREHOUSES}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= STOCK LEVELS =============

export async function getStockLevels(limit = 100, offset = 0, warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.STOCK_LEVELS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (warehouseId && warehouseId !== 'all') url += `&warehouse_id=eq.${warehouseId}`;
  return apiGet<any[]>(url);
}

export async function getLowStockProducts() {
  return apiGet<any[]>(API_ENDPOINTS.LOW_STOCK_PRODUCTS);
}

// ============= ROLES =============

export async function getRoles() {
  return apiGet<any[]>(`${API_ENDPOINTS.ROLES}?order=name.asc`);
}

export async function createRole(role: { name: string; description?: string; permissions: string[] }) {
  return apiPost<any>(API_ENDPOINTS.ROLES, {
    name: role.name.toLowerCase().replace(/\s+/g, '_'),
    description: role.description || '',
    permissions: role.permissions,
  });
}

export async function updateRole(id: string, updates: { permissions?: string[]; description?: string }) {
  return apiPatch<any>(`${API_ENDPOINTS.ROLES}?id=eq.${id}`, updates);
}

export async function deleteRole(id: string) {
  return apiDelete(`${API_ENDPOINTS.ROLES}?id=eq.${id}`);
}

// ============= USERS =============

export async function getUsers(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
}

export async function createUser(user: Record<string, unknown>) {
  // Ensure role_id is set (required by schema)
  // If no role_id provided, get the viewer role
  if (!user.role_id) {
    try {
      const viewerRole = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?name=eq.viewer`);
      if (viewerRole.data && viewerRole.data.length > 0) {
        user.role_id = viewerRole.data[0].id;
      } else {
      }
    } catch (error) {
      console.error('[USER] Error fetching viewer role:', error);
    }
  }

  // Auto-add company_id from current user session
  const companyId = getCurrentUserCompanyId();
  const userWithCompany = {
    ...user,
    company_id: companyId,
    role_id: user.role_id,
  };
  
  return apiPost<any>(API_ENDPOINTS.USERS, userWithCompany);
}

export async function updateUser(id: string, updates: Record<string, unknown>) {
  return apiPatch<any>(`${API_ENDPOINTS.USERS}?id=eq.${id}`, updates);
}

export async function deleteUser(id: string) {
  return apiDelete(`${API_ENDPOINTS.USERS}?id=eq.${id}`);
}

// ============= AUTHENTICATION =============

/**
 * Login user with email and password
 */
export async function loginUser(email: string, password: string) {
  try {

    // Admin alias: the credentials in .env (superadmin / sapword) log in as
    // this deployment's company admin account, without a separate superadmin flow.
    const adminAliasUser = process.env.SUPERADMIN_USERNAME ?? process.env.superadmin;
    const adminAliasPass = process.env.SUPERADMIN_PASSWORD ?? process.env.sapword;
    const adminAliasEmail = process.env.ADMIN_ALIAS_EMAIL;
    let lookupEmail = email;
    let skipPasswordCheck = false;
    if (adminAliasUser && adminAliasPass && adminAliasEmail
      && email === adminAliasUser && password === adminAliasPass) {
      lookupEmail = adminAliasEmail;
      skipPasswordCheck = true;
    }

    // Get user by email
    const userResult = await apiGet<any[]>(`${API_ENDPOINTS.USERS}?email=eq.${encodeURIComponent(lookupEmail)}&deleted_at=is.null`);

    if (userResult.error || !userResult.data || userResult.data.length === 0) {
      console.error('[AUTH] User not found:', lookupEmail);
      return { error: 'Invalid email or password', data: null };
    }

    const user = userResult.data[0];

    const passwordHash: string = user.password_hash ?? '';

    // Verify with bcrypt (new hashes) or fall back for legacy salt:password format
    const isBcryptHash = passwordHash.startsWith('$2');
    const isValidPassword = skipPasswordCheck || (isBcryptHash
      ? await bcrypt.compare(password, passwordHash)
      : (passwordHash.includes(':') && passwordHash.split(':')[1] === password)
        || passwordHash === password);

    if (!isValidPassword) {
      return { error: 'Invalid email or password', data: null };
    }
    
    
    // Get company info
    const companyResult = await apiGet<any[]>(`${API_ENDPOINTS.COMPANIES}?id=eq.${user.company_id}`);
    const company = companyResult.data?.[0];

    // Get role name and permissions from roles table
    let roleName = user.role || 'viewer';
    let rolePermissions: string[] = [];
    if (user.role_id) {
      try {
        const roleResult = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?id=eq.${user.role_id}`);
        if (roleResult.data && roleResult.data.length > 0) {
          roleName = roleResult.data[0].name;
          rolePermissions = Array.isArray(roleResult.data[0].permissions) ? roleResult.data[0].permissions : [];
        }
      } catch {}
    }
    // Admin users always get full access
    if (user.is_company_admin) {
      rolePermissions = ['all'];
    }

    // Build user data object
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      companyId: user.company_id,
      companyName: company?.name,
      isCompanyAdmin: user.is_company_admin,
      isSuperAdminCompany: company?.is_super_admin_company || false,
      role: roleName,
      permissions: rolePermissions,
      status: user.status,
      passwordIsTemporary: user.password_is_temporary || false,
      forcePasswordChange: user.force_password_change || false,
    };
    
    // Set signed, httpOnly cookie for server-side company isolation
    // The signature prevents any client-side tampering with companyId or permissions
    const cookieStore = cookies();
    cookieStore.set('user', signSession(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    
    
    // Return user info (without password)
    return {
      data: userData,
      error: null,
    };
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return { error: 'Login failed', data: null };
  }
}

/**
 * Change user password (used for forced password change after temporary password login)
 */
export async function changePassword(newPassword: string, userId: string) {
  try {
    
    if (!userId) {
      console.error('[PASSWORD] User ID is required');
      return { error: 'User ID is required', data: null };
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters', data: null };
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update user password and clear temporary password flags
    const updateResult = await apiPatch<any>(
      `${API_ENDPOINTS.USERS}?id=eq.${userId}`,
      {
        password_hash: hashedPassword,
        password_is_temporary: false,
        force_password_change: false,
        last_password_change: new Date().toISOString(),
      }
    );
    
    if (updateResult.error) {
      console.error('[PASSWORD] Failed to update password:', updateResult.error);
      return { error: 'Failed to update password', data: null };
    }
    
    return {
      data: { success: true },
      error: null,
    };
  } catch (error) {
    console.error('[PASSWORD] Error changing password:', error);
    return { error: 'Failed to change password', data: null };
  }
}

/**
 * Logout user - clears authentication cookie and session
 */
export async function logoutUser() {
  try {
    
    // Clear user cookie
    const cookieStore = cookies();
    cookieStore.delete('user');
    
    return { success: true, error: null };
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
    return { success: false, error: 'Logout failed' };
  }
}

// ============= SAAS USER MANAGEMENT =============

/**
 * Get all companies (super admin only) with recalculated user counts
 */
export async function getCompanies(limit = 100, offset = 0) {
  const result = await apiGet<any[]>(`${API_ENDPOINTS.COMPANIES}?order=created_at.desc&limit=${limit}&offset=${offset}`);

  if (result.error || !result.data) return result;

  try {
    // Fetch users and warehouses in parallel for all companies
    const [allUsersResult, allWarehousesResult] = await Promise.all([
      apiGet<any[]>(`${API_ENDPOINTS.USERS}?status=eq.active&deleted_at=is.null&select=id,company_id`),
      apiGet<any[]>(`${API_ENDPOINTS.WAREHOUSES}?status=neq.deleted&select=id,company_id`),
    ]);

    const userCountByCompany: Record<string, number> = {};
    if (!allUsersResult.error && allUsersResult.data) {
      allUsersResult.data.forEach((u: any) => {
        if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] || 0) + 1;
      });
    }

    const warehouseCountByCompany: Record<string, number> = {};
    if (!allWarehousesResult.error && allWarehousesResult.data) {
      allWarehousesResult.data.forEach((w: any) => {
        if (w.company_id) warehouseCountByCompany[w.company_id] = (warehouseCountByCompany[w.company_id] || 0) + 1;
      });
    }

    return {
      data: result.data.map((company: any) => ({
        ...company,
        active_users: userCountByCompany[company.id] || 0,
        active_warehouses: warehouseCountByCompany[company.id] || 0,
      })),
      error: null,
    };
  } catch (error) {
    console.error('[SAAS] Error calculating company stats:', error);
  }

  return result;
}

/**
 * Get single company with user count
 */
export async function getCompanyById(companyId: string) {
  const companyResult = await apiGet<any[]>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`);
  if (companyResult.error || !companyResult.data?.length) {
    return companyResult;
  }

  const company = companyResult.data[0];

  // Get active user count and warehouse count in parallel
  const [usersResult, warehousesResult] = await Promise.all([
    apiGet<any[]>(`${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&status=eq.active&deleted_at=is.null`),
    apiGet<any[]>(`${API_ENDPOINTS.WAREHOUSES}?company_id=eq.${companyId}&status=neq.deleted`),
  ]);

  const activeUsers = Array.isArray(usersResult.data) ? usersResult.data.length : 0;
  const activeWarehouses = Array.isArray(warehousesResult.data) ? warehousesResult.data.length : 0;

  return {
    data: {
      ...company,
      active_users: activeUsers,
      active_warehouses: activeWarehouses,
    },
    error: null,
  };
}

/**
 * Generate temporary password for company admin
 */
function generateTemporaryPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Create company admin user with password hashing
 */
export async function createCompanyAdmin(adminData: Record<string, unknown>) {
  try {

    // Hash the password
    const password = adminData.password as string;
    if (!password) {
      return { error: 'Password is required', data: null };
    }

    const hashedPassword = await hashPassword(password);

    // Use provided role_id or fall back to viewer role
    let adminRoleId: string | undefined = adminData.role_id as string | undefined;
    if (!adminRoleId) {
      try {
        const viewerRoleResult = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?name=eq.viewer`);
        if (viewerRoleResult.data && viewerRoleResult.data.length > 0) {
          adminRoleId = viewerRoleResult.data[0].id;
        } else {
          const anyRole = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?limit=1`);
          if (anyRole.data && anyRole.data.length > 0) {
            adminRoleId = anyRole.data[0].id;
          }
        }
      } catch (error) {
        console.error('[ADMIN] Error fetching role:', error);
      }
    }

    const userData = {
      company_id: adminData.company_id,
      first_name: adminData.first_name,
      last_name: adminData.last_name,
      email: adminData.email,
      phone: adminData.phone || null,
      password_hash: hashedPassword,
      is_company_admin: false, // Regular user, not an admin
      status: 'active',
      ...(adminRoleId && { role_id: adminRoleId }),
    };

    const result = await apiPost<any>(API_ENDPOINTS.USERS, userData);

    if (result.error) {
      console.error('[ADMIN] Error creating user:', result.error);
      return result;
    }

    // Update company active_users count
    try {
      const companyId = adminData.company_id as string;
      const companyResult = await getCompanyById(companyId);
      if (companyResult.data) {
        const currentCount = (companyResult.data as any).active_users || 0;
        await updateCompany(companyId, { active_users: currentCount + 1 });
      }
    } catch (error) {
      console.error('[ADMIN] Error updating company active_users count:', error);
      // Don't fail the user creation if this fails
    }

    return {
      data: result.data,
      error: null,
    };
  } catch (error) {
    console.error('[ADMIN] Error creating company admin:', error);
    return { error: 'Failed to create user', data: null };
  }
}

/**
 * Create new company (super admin only)
 * Also auto-creates a company admin user
 */
export async function createCompany(company: Record<string, unknown>) {
  try {
    
    // Step 1: Create the company
    const companyResult = await apiPost<any>(API_ENDPOINTS.COMPANIES, company);
    
    if (companyResult.error || !companyResult.data) {
      console.error('[SAAS] Company creation failed:', companyResult.error);
      return companyResult;
    }

    // Handle both array and single object responses from PostgREST
    const newCompanyData = Array.isArray(companyResult.data) 
      ? companyResult.data[0] 
      : companyResult.data;
    
    if (!newCompanyData || !newCompanyData.id) {
      console.error('[SAAS] Company data missing ID:', newCompanyData);
      return { error: 'Failed to create company: No ID returned', data: null };
    }

    const newCompany = newCompanyData;
    const companyId = newCompany.id;

    // Step 2: Create admin user for the company
    try {
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(temporaryPassword);
      
      // Use person in charge name for admin user, fallback to company name
      const personInChargeName = company.person_in_charge_name as string || 'Company Admin';
      const nameParts = personInChargeName.trim().split(' ');
      const adminFirstName = nameParts[0];
      const adminLastName = nameParts.slice(1).join(' ') || 'Admin';
      
      // Create admin user — find the admin role by trying common name variants
      let adminRoleId = undefined;
      try {
        const adminNames = ['admin', 'company_admin', 'administrator', 'manager'];
        for (const name of adminNames) {
          const res = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?name=eq.${name}&limit=1`);
          if (res.data && res.data.length > 0) {
            adminRoleId = res.data[0].id;
            break;
          }
        }
        // If still not found, try a partial match (ilike)
        if (!adminRoleId) {
          const res = await apiGet<any[]>(`${API_ENDPOINTS.ROLES}?name=ilike.*admin*&limit=1`);
          if (res.data && res.data.length > 0) {
            adminRoleId = res.data[0].id;
          }
        }
      } catch (error) {
        console.error('[SAAS] Error fetching admin role:', error);
      }
      
      const adminUser = {
        company_id: companyId,
        email: (company.email as string) || `admin-${Date.now()}@company.local`,
        first_name: adminFirstName,
        last_name: adminLastName,
        phone: (company.person_in_charge_contact as string) || null,
        password_hash: hashedPassword,
        ...(adminRoleId && { role_id: adminRoleId }), // Include role_id if found
        is_company_admin: true,
        status: 'active',
        password_is_temporary: true, // Mark password as temporary
        force_password_change: true, // Force password change on first login
      };

      const userResult = await apiPost<any>(API_ENDPOINTS.USERS, adminUser);

      if (!userResult.error && userResult.data) {
        
        // Update company active_users count
        await updateCompany(companyId, { active_users: 1 });
        
        // Return company with admin user details (including temporary password for display)
        return {
          data: {
            company: newCompany,
            adminUser: {
              id: userResult.data.id,
              email: userResult.data.email || (company.email as string),
              firstName: userResult.data.first_name,
              lastName: userResult.data.last_name,
              temporaryPassword: temporaryPassword, // Return plain password for one-time display
              status: 'active',
              isCompanyAdmin: true,
              instructions: 'Please log in with the temporary password above and change it immediately. The temporary password will be displayed only once.',
            },
          },
          error: null,
        };
      } else {
        // Return company even if admin creation failed
        return {
          data: {
            company: newCompany,
            adminUser: null,
            warning: 'Company created successfully, but admin user creation failed. Please create admin user manually.',
          },
          error: null,
        };
      }
    } catch (error) {
      console.error('[SAAS] Error creating admin user for company:', error);
      // Return company even if admin creation failed
      return {
        data: {
          company: newCompany,
          adminUser: null,
          warning: 'Company created successfully, but admin user creation encountered an error. Please create admin user manually.',
        },
        error: null,
      };
    }
  } catch (error) {
    console.error('[SAAS] Error creating company:', error);
    return { error: 'Failed to create company', data: null };
  }
}

/**
 * Update company (super admin or company admin)
 */
export async function updateCompany(companyId: string, updates: Record<string, unknown>) {
  return apiPatch<any>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`, updates);
}

/**
 * Deactivate a company (set subscription_status to suspended and status to inactive)
 */
export async function deactivateCompany(companyId: string) {
  return apiPatch<any>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`, {
    subscription_status: 'suspended',
    status: 'inactive',
  });
}

/**
 * Delete company (super admin only - hard delete)
 */
export async function deleteCompany(companyId: string) {
  return apiDelete<any>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`);
}

/**
 * Upload company logo for documents and invoices
 * Admin access only
 */
export async function uploadCompanyLogo(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      return { error: 'No file provided' };
    }

    if (!companyId) {
      return { error: 'Company ID is required' };
    }

    // Create a base64 encoded string from the file
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Update company with logo
    const result = await apiPatch<any>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`, {
      logo_url: dataUrl,
    });

    if (result.error) {
      return { error: 'Failed to upload logo' };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('[LOGO] Upload error:', error);
    return { error: 'Failed to process logo' };
  }
}

/**
 * Get users for a specific company with admin filtering
 */
export async function getUsersByCompany(companyId: string, limit = 100, offset = 0) {
  return apiGet<any[]>(
    `${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&deleted_at=is.null&order=is_company_admin.desc,created_at.desc&limit=${limit}&offset=${offset}`
  );
}

/**
 * Check if company can add more users (respects plan limits)
 */
export async function canAddUser(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const companyResult = await getCompanyById(companyId);
    if (companyResult.error || !companyResult.data) {
      return { allowed: false, reason: 'Company not found' };
    }

    const companyData = companyResult.data as any;

    // Check if subscription is active
    if (companyData.subscription_status !== 'active') {
      return { allowed: false, reason: `Subscription is ${companyData.subscription_status}` };
    }

    // Check user limit
    if (companyData.active_users >= companyData.user_limit) {
      return {
        allowed: false,
        reason: `User limit reached (${companyData.active_users}/${companyData.user_limit})`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[SAAS] Error checking user limit:', error);
    return { allowed: false, reason: 'Error checking user limit' };
  }
}

/**
 * Check if company can add more warehouses (respects plan warehouse_limit)
 */
export async function canAddWarehouse(companyId: string): Promise<{ allowed: boolean; current: number; limit: number; reason?: string }> {
  try {
    const companyResult = await getCompanyById(companyId);
    if (companyResult.error || !companyResult.data) {
      return { allowed: false, current: 0, limit: 0, reason: 'Company not found' };
    }

    const company = companyResult.data as any;

    if (company.subscription_status !== 'active') {
      return { allowed: false, current: 0, limit: 0, reason: `Subscription is ${company.subscription_status}` };
    }

    // Count existing (non-deleted) warehouses for this company
    const warehousesResult = await apiGet<any[]>(
      `${API_ENDPOINTS.WAREHOUSES}?company_id=eq.${companyId}&status=neq.deleted`
    );
    const current = Array.isArray(warehousesResult.data) ? warehousesResult.data.length : 0;

    // warehouse_limit of 999 means unlimited
    const limit: number = company.warehouse_limit ?? 999;
    if (limit < 999 && current >= limit) {
      return {
        allowed: false,
        current,
        limit,
        reason: `Warehouse limit reached (${current}/${limit}). Upgrade your plan to add more warehouses.`,
      };
    }

    return { allowed: true, current, limit };
  } catch (error) {
    console.error('[SAAS] Error checking warehouse limit:', error);
    return { allowed: false, current: 0, limit: 0, reason: 'Error checking warehouse limit' };
  }
}

/**
 * Create user with limit enforcement
 */
export async function createUserWithLimitCheck(user: Record<string, unknown>) {
  const companyId = user.company_id as string;

  if (!companyId) {
    return { error: { message: 'Company ID is required' }, data: null };
  }

  // Check if company can add more users
  const canAdd = await canAddUser(companyId);
  if (!canAdd.allowed) {
    return { error: { message: canAdd.reason || 'Cannot add user' }, data: null };
  }

  const result = await createUser(user);

  if (!result.error) {
    // Update company active_users count
    const updateResult = await apiGet<any>(`${API_ENDPOINTS.COMPANIES}?id=eq.${companyId}`);
    if (updateResult.data?.length) {
      const usersResult = await apiGet<any[]>(
        `${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&status=eq.active&deleted_at=is.null`
      );
      const activeUsers = Array.isArray(usersResult.data) ? usersResult.data.length : 0;
      await updateCompany(companyId, { active_users: activeUsers });
    }
  }

  return result;
}

/**
 * Set user as company admin
 */
export async function setCompanyAdmin(userId: string, isAdmin: boolean) {
  return apiPatch<any>(`${API_ENDPOINTS.USERS}?id=eq.${userId}`, {
    is_company_admin: isAdmin,
  });
}

/**
 * Get company admins
 */
export async function getCompanyAdmins(companyId: string) {
  return apiGet<any[]>(
    `${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&is_company_admin=eq.true&deleted_at=is.null`
  );
}

/**
 * Soft delete user (set deleted_at instead of hard delete)
 */
export async function softDeleteUser(userId: string) {
  return apiPatch<any>(`${API_ENDPOINTS.USERS}?id=eq.${userId}`, {
    deleted_at: new Date().toISOString(),
    status: 'deleted',
  });
}

/**
 * Super admin: Permanently delete a user (hard delete)
 */
export async function deleteUserPermanently(userId: string) {
  try {
    const result = await apiDelete(`${API_ENDPOINTS.USERS}?id=eq.${userId}`);
    return result;
  } catch (error) {
    console.error('[SAAS] Error permanently deleting user:', error);
    return { error: 'Failed to delete user', data: null };
  }
}

/**
 * Super admin: Change user's role and admin status
 */
export async function changeUserRole(userId: string, roleId: string, isAdmin: boolean = false) {
  try {
    
    const updates: Record<string, any> = {
      role_id: roleId,
      is_company_admin: isAdmin,
    };
    
    const result = await apiPatch<any>(
      `${API_ENDPOINTS.USERS}?id=eq.${userId}`,
      updates
    );
    
    return result;
  } catch (error) {
    console.error('[SAAS] Error changing user role:', error);
    return { error: 'Failed to change user role', data: null };
  }
}

/**
 * Super admin: Activate/Deactivate user
 */
export async function toggleUserStatus(userId: string, status: 'active' | 'inactive' | 'suspended') {
  try {
    
    const result = await apiPatch<any>(
      `${API_ENDPOINTS.USERS}?id=eq.${userId}`,
      { status }
    );
    
    return result;
  } catch (error) {
    console.error('[SAAS] Error changing user status:', error);
    return { error: 'Failed to change user status', data: null };
  }
}

/**
 * Super admin: Update user details
 */
export async function updateUserDetails(userId: string, details: Record<string, any>) {
  try {
    
    const result = await apiPatch<any>(
      `${API_ENDPOINTS.USERS}?id=eq.${userId}`,
      details
    );
    
    return result;
  } catch (error) {
    console.error('[SAAS] Error updating user:', error);
    return { error: 'Failed to update user', data: null };
  }
}

/**
 * Reset user password (super admin only)
 * Generates a new password and returns both the new password and hash
 */
export async function resetUserPassword(userId: string) {
  try {
    
    // Generate new password
    const newPassword = generateTemporaryPassword();
    
    // Hash the password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update user with new password
    const result = await apiPatch<any>(
      `${API_ENDPOINTS.USERS}?id=eq.${userId}`,
      { password_hash: hashedPassword }
    );
    
    if (result.error) {
      console.error('[SAAS] Error resetting password:', result.error);
      return { error: 'Failed to reset password', data: null };
    }
    
    // Return the new password (only shown once)
    return { 
      data: { 
        message: 'Password reset successfully',
        newPassword: newPassword 
      }, 
      error: null 
    };
  } catch (error) {
    console.error('[SAAS] Error resetting password:', error);
    return { error: 'Failed to reset password', data: null };
  }
}

// ============= INVOICES SUMMARY & OUTSTANDING =============

export async function getInvoiceSummary() {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any>(`${API_ENDPOINTS.INVOICE_SUMMARY}?company_id=eq.${companyId}`);
}

export async function getOutstandingInvoices() {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.OUTSTANDING_INVOICES}?company_id=eq.${companyId}`);
}

// ============= PAYMENTS =============

export async function getPayments(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.PAYMENTS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.PAYMENTS}?invoice_id=eq.${invoiceId}&order=created_at.desc`);
}

export async function createPayment(payment: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  return apiPost<any>(API_ENDPOINTS.PAYMENTS, {
    ...payment,
    company_id: companyId,
    ...(userId ? { recorded_by_id: userId } : {}),
  });
}

export async function recordInvoicePayment(invoiceId: string, amount: number, method: string, reference: string, notes: string, clientUserId?: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId() || clientUserId || null;

  if (!userId) {
    return { data: null, error: { message: 'User session expired. Please refresh and try again.' } };
  }

  // Get current invoice to check amount_paid and total
  const invRes = await apiGet<any[]>(`${API_ENDPOINTS.INVOICES}?id=eq.${invoiceId}&company_id=eq.${companyId}`);
  if (invRes.error || !Array.isArray(invRes.data) || !invRes.data[0]) {
    return { data: null, error: { message: 'Invoice not found' } };
  }
  const invoice = invRes.data[0];
  const newAmountPaid = parseFloat(String(invoice.amount_paid || 0)) + amount;
  const total = parseFloat(String(invoice.total_amount || 0));
  const newStatus = newAmountPaid >= total ? 'paid' : 'partially_paid';

  // Create payment record
  const payRes = await apiPost<any>(API_ENDPOINTS.PAYMENTS, {
    company_id: companyId,
    invoice_id: invoiceId,
    amount,
    payment_method: method,
    payment_date: new Date().toISOString().split('T')[0], // date only
    transaction_reference: reference || null,
    notes: notes || null,
    recorded_by_id: userId,
  });
  if (payRes.error) return payRes;

  // Update invoice amount_paid and status
  const updateRes = await apiPatch<any>(
    `${API_ENDPOINTS.INVOICES}?id=eq.${invoiceId}&company_id=eq.${companyId}`,
    { amount_paid: newAmountPaid, status: newStatus }
  );
  if (updateRes.error) return updateRes;

  return { data: { payment: payRes.data, invoice: updateRes.data, newStatus }, error: null };
}

export async function updatePayment(id: string, updates: Record<string, unknown>) {
  return apiPatch<any>(`${API_ENDPOINTS.PAYMENTS}?id=eq.${id}`, updates);
}

// ============= INVOICE ITEMS =============

export async function getInvoiceItems(invoiceId: string) {
  return apiGet<any[]>(`${API_ENDPOINTS.INVOICE_ITEMS}?invoice_id=eq.${invoiceId}&order=created_at.asc`);
}

export async function createInvoiceItem(item: Record<string, unknown>) {
  return apiPost<any>(API_ENDPOINTS.INVOICE_ITEMS, item);
}

// ============= AUDIT LOGS =============

export async function getAuditLogs(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(`${API_ENDPOINTS.AUDIT_LOGS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
}

// ============= PRODUCT CATEGORIES =============

export async function getProductCategories(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.PRODUCT_CATEGORIES}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function getProductCategoryById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any>(`${API_ENDPOINTS.PRODUCT_CATEGORIES}?id=eq.${id}&company_id=eq.${companyId}`);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function createProductCategory(category: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const categoryWithCompany = {
    ...category,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.PRODUCT_CATEGORIES, categoryWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateProductCategory(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.PRODUCT_CATEGORIES}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteProductCategory(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.PRODUCT_CATEGORIES}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= UNIT OF MEASUREMENTS =============

export async function getUnitOfMeasurements(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.UNIT_OF_MEASUREMENTS}?company_id=eq.${companyId}&order=created_at.desc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function createUnitOfMeasurement(unit: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const unitWithCompany = {
    ...unit,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.UNIT_OF_MEASUREMENTS, unitWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateUnitOfMeasurement(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.UNIT_OF_MEASUREMENTS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteUnitOfMeasurement(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.UNIT_OF_MEASUREMENTS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= BIN LOCATIONS =============

export interface BinLocation {
  id: string;
  company_id: string;
  warehouse_id: string;
  location_name?: string | null;
  zone?: string | null;
  aisle?: string | null;
  shelf?: string | null;
  bin_number?: string | null;
  capacity?: number | null;
  current_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  status: 'available' | 'reserved' | 'maintenance' | 'archived';
  description?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface BinStock {
  id: string;
  bin_location_id: string;
  product_id: string;
  company_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_count_date?: string;
  created_at: string;
  updated_at: string;
}

export async function getBinLocations(
  warehouseId?: string,
  limit = 100,
  offset = 0
) {
  const companyId = getCurrentUserCompanyId();
  let query: string;

  if (warehouseId) {
    // warehouse_id already scopes to the company — don't require a valid session cookie
    query = `${API_ENDPOINTS.BIN_LOCATIONS}?warehouse_id=eq.${warehouseId}&deleted_at=is.null`;
  } else {
    query = `${API_ENDPOINTS.BIN_LOCATIONS}?company_id=eq.${companyId}&deleted_at=is.null`;
  }
  
  query += `&order=zone.asc,aisle.asc,shelf.asc,bin_number.asc&limit=${limit}&offset=${offset}`;
  
  const response = await apiGet<BinLocation[]>(query);
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as BinLocation[],
    error: null,
  };
}

export async function getBinLocationById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<BinLocation[]>(
    `${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${id}&company_id=eq.${companyId}&deleted_at=is.null`
  );
  
  if (response.error) return response;
  if (!response.data || response.data.length === 0) {
    return { data: null, error: 'Bin location not found' };
  }
  
  return {
    data: JSON.parse(JSON.stringify(response.data[0])) as BinLocation,
    error: null,
  };
}

export async function getBinLocationsByWarehouse(warehouseId: string) {
  return getBinLocations(warehouseId);
}

export async function getWarehouseUtilization(warehouseId: string) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(
    `${API_ENDPOINTS.WAREHOUSE_CAPACITY_OVERVIEW}?company_id=eq.${companyId}&warehouse_id=eq.${warehouseId}`
  );
  
  if (response.error) return response;
  if (!response.data || response.data.length === 0) {
    return { data: null, error: 'Warehouse not found' };
  }
  
  return {
    data: JSON.parse(JSON.stringify(response.data[0])),
    error: null,
  };
}

export async function createBinLocation(
  binData: Omit<BinLocation, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
) {
  const companyId = getCurrentUserCompanyId();
  const payload = {
    ...binData,
    company_id: companyId,
  };
  
  const response = await apiPost<BinLocation>(API_ENDPOINTS.BIN_LOCATIONS, payload);
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as BinLocation,
    error: null,
  };
}

export async function updateBinLocation(
  id: string,
  updates: Partial<Omit<BinLocation, 'id' | 'company_id' | 'created_at' | 'updated_at'>>
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<BinLocation>(
    `${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${id}&company_id=eq.${companyId}`,
    updates
  );
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as BinLocation,
    error: null,
  };
}

export async function deleteBinLocation(id: string) {
  // Soft delete using updated_at and deleted_at
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch(
    `${API_ENDPOINTS.BIN_LOCATIONS}?id=eq.${id}&company_id=eq.${companyId}`,
    { deleted_at: new Date().toISOString() }
  );
  
  return response;
}

export async function getAvailableBins(warehouseId?: string) {
  const companyId = getCurrentUserCompanyId();
  let query = `${API_ENDPOINTS.AVAILABLE_BINS}?company_id=eq.${companyId}`;
  
  if (warehouseId) {
    query += `&warehouse_id=eq.${warehouseId}`;
  }
  
  query += '&order=utilization_percent.asc';
  
  const response = await apiGet<any[]>(query);
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function getBinStock(binLocationId: string) {
  const response = await apiGet<BinStock[]>(
    `bin_stock?bin_location_id=eq.${binLocationId}`
  );
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as BinStock[],
    error: null,
  };
}

export async function getProductBinDistribution(productId: string) {
  const response = await apiGet<any[]>(
    `bin_stock?product_id=eq.${productId}`
  );
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function transferStockBetweenBins(
  fromBinId: string,
  toBinId: string,
  productId: string,
  // quantity: number,
  notes?: string
) {
  const companyId = getCurrentUserCompanyId();
  
  // Create stock transfer record
  const transferPayload = {
    company_id: companyId,
    from_bin_id: fromBinId,
    to_bin_id: toBinId,
    status: 'completed',
    notes: notes || `Transfer of product ${productId}`,
    created_at: new Date().toISOString(),
  };
  
  const response = await apiPost<any>(API_ENDPOINTS.STOCK_TRANSFERS, transferPayload);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

// ============= INVENTORY INTEGRATION (Receiving) =============

/**
 * Shared helper: find the stock level record for a product in a specific warehouse.
 * - If warehouseId is provided: matches on product + company + warehouse (per-warehouse tracking).
 * - Falls back to the first unscoped record for the product so legacy rows are still found.
 */
async function findStockLevel(productId: string, companyId: string, warehouseId?: string) {
  // 1. Try exact match: product + company + warehouse
  if (warehouseId) {
    const scoped = await apiGet<any[]>(
      `${API_ENDPOINTS.STOCK_LEVELS}?product_id=eq.${productId}&company_id=eq.${companyId}&warehouse_id=eq.${warehouseId}`
    );
    if (scoped.data && Array.isArray(scoped.data) && scoped.data.length > 0) {
      return scoped.data[0];
    }
  }

  // 2. Fallback: match product + company without warehouse filter (legacy / unassigned rows)
  const fallback = await apiGet<any[]>(
    `${API_ENDPOINTS.STOCK_LEVELS}?product_id=eq.${productId}&company_id=eq.${companyId}&limit=1`
  );
  if (fallback.data && Array.isArray(fallback.data) && fallback.data.length > 0) {
    return fallback.data[0];
  }

  return null;
}

export async function updateStockLevels(
  productId: string,
  quantityChange: number,
  warehouseId?: string
) {
  const companyId = getCurrentUserCompanyId();
  const stockLevel = await findStockLevel(productId, companyId, warehouseId);

  if (stockLevel) {
    return apiPatch<any>(
      `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
      { quantity_on_hand: Math.max(0, (stockLevel.quantity_on_hand || 0) + quantityChange) }
    );
  }
  // Create new per-warehouse stock level
  return apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId ?? null,
    quantity_on_hand: Math.max(0, quantityChange),
  });
}

export async function updateStockReservation(
  productId: string,
  reservationQuantityChange: number,
  warehouseId?: string
) {
  const companyId = getCurrentUserCompanyId();
  const stockLevel = await findStockLevel(productId, companyId, warehouseId);

  if (stockLevel) {
    return apiPatch<any>(
      `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
      { quantity_allocated: Math.max(0, (stockLevel.quantity_allocated || 0) + reservationQuantityChange) }
    );
  }
  // Create new per-warehouse stock level with reservation
  return apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId ?? null,
    quantity_allocated: Math.max(0, reservationQuantityChange),
  });
}

/**
 * Atomic update of both on_hand and allocated in a SINGLE read + SINGLE write.
 * Use this for ship/fulfillment to prevent race conditions.
 * Always pass warehouseId to deduct from the correct warehouse.
 */
export async function updateStockLevelAtomic(
  productId: string,
  onHandDelta: number,
  reservedDelta: number,
  warehouseId?: string
) {
  const companyId = getCurrentUserCompanyId();
  const stockLevel = await findStockLevel(productId, companyId, warehouseId);

  if (stockLevel) {
    return apiPatch<any>(
      `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
      {
        quantity_on_hand: Math.max(0, (stockLevel.quantity_on_hand || 0) + onHandDelta),
        quantity_allocated: Math.max(0, (stockLevel.quantity_allocated || 0) + reservedDelta),
      }
    );
  }
  return apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
    company_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId ?? null,
    quantity_on_hand: Math.max(0, onHandDelta),
    quantity_allocated: Math.max(0, reservedDelta),
  });
}

export async function updateStockRejection(
  productId: string,
  rejectionQuantityChange: number
) {
  const companyId = getCurrentUserCompanyId();
  
  // Get existing stock level for this product in company
  const response = await apiGet<any[]>(`${API_ENDPOINTS.STOCK_LEVELS}?product_id=eq.${productId}&company_id=eq.${companyId}`);
  
  if (response.data && Array.isArray(response.data) && response.data.length > 0) {
    // Update existing stock level
    const stockLevel = response.data[0];
    
    // When rejecting items:
    // - Reduce quantity_on_hand (items are no longer available)
    // - Increase quantity_rejected (items in rejection queue)
    const newOnHandQty = Math.max(0, (stockLevel.quantity_on_hand || 0) - rejectionQuantityChange);
    const newRejectionQty = Math.max(0, (stockLevel.quantity_rejected || 0) + rejectionQuantityChange);
    
    // Create stock transaction for audit trail
    try {
      await createStockTransaction({
        product_id: productId,
        transaction_type: 'rejected',
        quantity: rejectionQuantityChange,
        notes: 'Items marked as rejected during QC',
      });
    } catch (error) {
      // Log but don't fail if transaction creation fails
    }
    
    // Update stock levels with both on_hand reduction and rejection increase
    return apiPatch<any>(
      `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
      {
        quantity_on_hand: newOnHandQty,
        quantity_rejected: newRejectionQty,
      }
    );
  } else {
    // Create new stock level with rejection (shouldn't normally happen)
    return apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
      company_id: companyId,
      product_id: productId,
      quantity_rejected: Math.max(0, rejectionQuantityChange),
    });
  }
}

export async function processRejectionDisposition(
  productId: string,
  dispositionType: string,
  quantity: number,
  notes: string
) {
  const companyId = getCurrentUserCompanyId();

  try {
    // Debug logging
    const queryUrl = `${API_ENDPOINTS.STOCK_LEVELS}?product_id=eq.${productId}&company_id=eq.${companyId}`;

    // Get current stock level
    const response = await apiGet<any[]>(queryUrl);

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return {
        data: null,
        error: { message: 'Stock level not found' },
      };
    }

    const stockLevel = response.data[0];

    if ((stockLevel.quantity_rejected || 0) < quantity) {
      return {
        data: null,
        error: { message: 'Not enough rejected items to process' },
      };
    }

    let updatePayload: Record<string, any> = {};
    let transactionType = 'adjusted';

    // For return_to_supplier, find the originating PO via GRN items
    let linkedPoId: string | undefined;
    let linkedPoNumber: string | undefined;
    if (dispositionType === 'return_to_supplier') {
      try {
        const grnItemsRes = await apiGet<any[]>(
          `${API_ENDPOINTS.GRN_ITEMS}?product_id=eq.${productId}&quantity_rejected=gt.0&order=created_at.desc&limit=1`
        );
        if (grnItemsRes.data && Array.isArray(grnItemsRes.data) && grnItemsRes.data.length > 0) {
          const grnItem = grnItemsRes.data[0];
          const grnRes = await apiGet<any[]>(`${API_ENDPOINTS.GRN}?id=eq.${grnItem.grn_id}&limit=1`);
          if (grnRes.data && Array.isArray(grnRes.data) && grnRes.data.length > 0) {
            const grn = grnRes.data[0];
            linkedPoId = grn.purchase_order_id;
            const poRes = await apiGet<any[]>(
              `${API_ENDPOINTS.PURCHASE_ORDERS}?id=eq.${grn.purchase_order_id}&select=po_number&limit=1`
            );
            if (poRes.data && Array.isArray(poRes.data) && poRes.data.length > 0) {
              linkedPoNumber = poRes.data[0].po_number;
            }
          }
        }
      } catch {
        // Non-fatal — proceed without PO link
      }
    }

    switch (dispositionType) {
      case 'return_to_supplier':
        // Items leave inventory — reduce rejected quantity
        updatePayload = {
          quantity_rejected: Math.max(0, (stockLevel.quantity_rejected || 0) - quantity),
        };
        transactionType = 'return_to_supplier';
        break;

      case 'rework':
        // Items stay in rejected queue, just tracked
        updatePayload = {};
        transactionType = 'adjusted';
        break;

      case 'scrap':
        // Items written off — reduce rejected quantity, track scrapped total
        updatePayload = {
          quantity_rejected: Math.max(0, (stockLevel.quantity_rejected || 0) - quantity),
          quantity_scrapped: (stockLevel.quantity_scrapped || 0) + quantity,
        };
        transactionType = 'adjusted';
        break;

      case 'restock':
        // Inspection error — move back to usable on_hand
        updatePayload = {
          quantity_on_hand: (stockLevel.quantity_on_hand || 0) + quantity,
          quantity_rejected: Math.max(0, (stockLevel.quantity_rejected || 0) - quantity),
        };
        transactionType = 'inbound';
        break;

      default:
        return {
          data: null,
          error: { message: 'Invalid disposition type' },
        };
    }

    // Update stock levels
    if (Object.keys(updatePayload).length > 0) {
      await apiPatch<any>(
        `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
        updatePayload
      );
    }

    // Create transaction record with PO reference when returning to supplier
    await createStockTransaction({
      product_id: productId,
      transaction_type: transactionType,
      quantity: quantity,
      notes: linkedPoNumber
        ? `[${dispositionType.toUpperCase()}] PO: ${linkedPoNumber} — ${notes}`
        : `[${dispositionType.toUpperCase()}] ${notes}`,
      ...(linkedPoId ? { reference_id: linkedPoId, reference_type: 'purchase_order' } : {}),
    });

    return {
      data: {
        dispositionType,
        quantity,
        remaining_rejected: Math.max(0, (stockLevel.quantity_rejected || 0) - quantity),
        linked_po_id: linkedPoId,
        linked_po_number: linkedPoNumber,
      },
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error processing rejection disposition:', err);
    return {
      data: null,
      error: { message: err.message },
    };
  }
}

export async function getSupplierReturnsByPO(poId: string) {
  const companyId = getCurrentUserCompanyId();
  try {
    const txRes = await apiGet<any[]>(
      `${API_ENDPOINTS.STOCK_TRANSACTIONS}?reference_id=eq.${poId}&reference_type=eq.purchase_order&transaction_type=eq.return_to_supplier&company_id=eq.${companyId}&order=created_at.desc`
    );
    if (txRes.error || !Array.isArray(txRes.data)) return { data: [], error: txRes.error };

    if (txRes.data.length === 0) return { data: [], error: null };

    // Enrich with product names
    const productIds = [...new Set(txRes.data.map((t: any) => t.product_id))];
    const productsRes = await apiGet<any[]>(
      `${API_ENDPOINTS.PRODUCTS}?id=in.(${productIds.join(',')})&select=id,name,sku`
    );
    const productMap: Record<string, any> = {};
    if (Array.isArray(productsRes.data)) {
      productsRes.data.forEach((p: any) => { productMap[p.id] = p; });
    }

    const enriched = txRes.data.map((t: any) => ({
      ...t,
      product_name: productMap[t.product_id]?.name || 'Unknown Product',
      product_sku: productMap[t.product_id]?.sku || '',
    }));

    return { data: enriched, error: null };
  } catch (err) {
    return { data: [], error: { message: String(err) } };
  }
}

export async function createStockTransaction(data: {
  product_id: string;
  transaction_type: string;
  quantity: number;
  notes?: string;
  reference_id?: string;
  reference_type?: string;
  stock_level_id?: string;
  warehouse_id?: string;
}) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  return apiPost<any>(API_ENDPOINTS.STOCK_TRANSACTIONS, {
    company_id: companyId,
    product_id: data.product_id,
    transaction_type: data.transaction_type,
    quantity: Math.round(data.quantity),
    notes: data.notes || null,
    reference_id: data.reference_id || null,
    reference_type: data.reference_type || null,
    stock_level_id: data.stock_level_id || null,
    warehouse_id: data.warehouse_id || null,
    ...(userId ? { created_by: userId } : {}),
  });
}

export async function getCompanyUsers() {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(`${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&deleted_at=is.null&select=id,first_name,last_name,email`);
  if (res.error || !Array.isArray(res.data)) return { data: {} as Record<string, string>, error: res.error };
  const map: Record<string, string> = {};
  res.data.forEach((u: any) => {
    map[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id;
  });
  return { data: map, error: null };
}

export async function getCompanyUsersByCompanyId(companyId: string) {
  return apiGet<any[]>(
    `${API_ENDPOINTS.USERS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc`
  );
}

export async function getStockTransactionsByProduct(productId: string) {
  const companyId = getCurrentUserCompanyId();
  return apiGet<any[]>(
    `${API_ENDPOINTS.STOCK_TRANSACTIONS}?product_id=eq.${productId}&company_id=eq.${companyId}&order=created_at.desc&limit=100`
  );
}

export async function getStockLocationsByProduct(productId: string) {
  const companyId = getCurrentUserCompanyId();

  const binStockRes = await apiGet<any[]>(
    `${API_ENDPOINTS.BIN_STOCK}?product_id=eq.${productId}&company_id=eq.${companyId}&quantity=gt.0`
  );
  if (binStockRes.error || !Array.isArray(binStockRes.data) || binStockRes.data.length === 0) {
    return { data: [], error: binStockRes.error };
  }

  const binIds = [...new Set(binStockRes.data.map((r: any) => r.bin_location_id))];
  const binsRes = await apiGet<any[]>(
    `${API_ENDPOINTS.BIN_LOCATIONS}?id=in.(${binIds.join(',')})&company_id=eq.${companyId}`
  );
  const bins: Record<string, any> = {};
  if (Array.isArray(binsRes.data)) {
    binsRes.data.forEach((b: any) => { bins[b.id] = b; });
  }

  const warehouseIds = [...new Set(Object.values(bins).map((b: any) => b.warehouse_id))];
  const warehousesRes = await apiGet<any[]>(
    `${API_ENDPOINTS.WAREHOUSES}?id=in.(${warehouseIds.join(',')})&company_id=eq.${companyId}`
  );
  const warehouses: Record<string, any> = {};
  if (Array.isArray(warehousesRes.data)) {
    warehousesRes.data.forEach((w: any) => { warehouses[w.id] = w; });
  }

  const enriched = binStockRes.data.map((bs: any) => {
    const bin = bins[bs.bin_location_id] || {};
    const warehouse = warehouses[bin.warehouse_id] || {};
    return {
      bin_stock_id: bs.id,
      bin_location_id: bs.bin_location_id,
      warehouse_id: bin.warehouse_id,
      warehouse_name: warehouse.name || 'Unknown',
      warehouse_address: warehouse.city || warehouse.address || '',
      zone: bin.zone || '—',
      aisle: bin.aisle || '—',
      shelf: bin.shelf || '—',
      bin_number: bin.bin_number || '—',
      quantity: bs.quantity,
      allocated_quantity: bs.allocated_quantity,
      available_quantity: bs.available_quantity,
    };
  });

  return { data: enriched, error: null };
}

export async function getAllStockTransactions(filters?: {
  transactionType?: string;
  productId?: string;
  referenceType?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
  limit?: number;
  offset?: number;
}) {
  const companyId = getCurrentUserCompanyId();
  // Build query string manually so we can append duplicate keys for date range
  const parts: string[] = [
    `company_id=eq.${companyId}`,
    `order=created_at.desc`,
    `limit=${filters?.limit ?? 100}`,
    `offset=${filters?.offset ?? 0}`,
  ];
  if (filters?.transactionType && filters.transactionType !== 'all') {
    parts.push(`transaction_type=eq.${filters.transactionType}`);
  }
  if (filters?.productId) {
    parts.push(`product_id=eq.${filters.productId}`);
  }
  if (filters?.referenceType && filters.referenceType !== 'all') {
    parts.push(`reference_type=eq.${filters.referenceType}`);
  }
  if (filters?.dateFrom) {
    parts.push(`created_at=gte.${filters.dateFrom}`);
  }
  if (filters?.dateTo) {
    parts.push(`created_at=lte.${filters.dateTo}T23:59:59`);
  }
  if (filters?.warehouseId && filters.warehouseId !== 'all') {
    parts.push(`or=(warehouse_id.eq.${filters.warehouseId},warehouse_id.is.null)`);
  }
  return apiGet<any[]>(`${API_ENDPOINTS.STOCK_TRANSACTIONS}?${parts.join('&')}`);
}

/** @deprecated use getShippedTotals instead */
export async function getOutboundTotals(): Promise<{ data: Record<string, number>; error: any }> {
  return getShippedTotals();
}

/**
 * Returns total quantity shipped (all outbound stock transactions) per product.
 * This reflects what has physically left the warehouse, regardless of SO status.
 */
export async function getShippedTotals(): Promise<{ data: Record<string, number>; error: any }> {
  const companyId = getCurrentUserCompanyId();
  const txRes = await apiGet<{ product_id: string; quantity: number }[]>(
    `${API_ENDPOINTS.STOCK_TRANSACTIONS}?company_id=eq.${companyId}&transaction_type=eq.outbound&select=product_id,quantity`
  );
  if (txRes.error || !Array.isArray(txRes.data)) return { data: {}, error: txRes.error };

  const totals: Record<string, number> = {};
  txRes.data.forEach(row => {
    totals[row.product_id] = (totals[row.product_id] || 0) + Number(row.quantity);
  });
  return { data: totals, error: null };
}

/**
 * Returns total quantity issued to production (via Material Issue Slips) per product.
 */
export async function getIssuedTotals(): Promise<{ data: Record<string, number>; error: any }> {
  const res = await apiGet<{ product_id: string; quantity_issued: number }[]>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS}?select=product_id,quantity_issued&product_id=not.is.null`
  );
  if (res.error || !Array.isArray(res.data)) return { data: {}, error: res.error };

  const totals: Record<string, number> = {};
  res.data.forEach(row => {
    if (!row.product_id) return;
    totals[row.product_id] = (totals[row.product_id] || 0) + Number(row.quantity_issued);
  });
  return { data: totals, error: null };
}

export async function updateBinStock(
  binLocationId: string,
  productId: string,
  quantity: number
) {
  const companyId = getCurrentUserCompanyId();
  
  // Try to get existing bin stock
  const response = await apiGet<any[]>(`${API_ENDPOINTS.BIN_STOCK}?bin_location_id=eq.${binLocationId}&product_id=eq.${productId}&company_id=eq.${companyId}`);
  
  if (response.data && Array.isArray(response.data) && response.data.length > 0) {
    // Update existing bin stock
    const binStock = response.data[0];
    return apiPatch<any>(
      `${API_ENDPOINTS.BIN_STOCK}?id=eq.${binStock.id}`,
      {
        quantity: (binStock.quantity || 0) + quantity,
      }
    );
  } else {
    // Create new bin stock entry
    return apiPost<any>(API_ENDPOINTS.BIN_STOCK, {
      bin_location_id: binLocationId,
      product_id: productId,
      company_id: companyId,
      quantity: quantity,
    });
  }
}

// ============= PRODUCT BATCHES (for SME batch tracking) =============

export interface ProductBatch {
  id: string;
  company_id: string;
  product_id: string;
  batch_number: string;
  mfg_date?: string;
  expiration_date?: string;
  quantity_received: number;
  quantity_used: number;
  quantity_available: number;
  warehouse_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Get all batches for a product
export async function getBatchesForProduct(productId: string) {
  const companyId = getCurrentUserCompanyId();
  
  const response = await apiGet<ProductBatch[]>(
    `${API_ENDPOINTS.PRODUCT_BATCHES}?company_id=eq.${companyId}&product_id=eq.${productId}&order=created_at.asc`
  );
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as ProductBatch[],
    error: null,
  };
}

// Get batches with allocation method (FIFO/FEFO/LIFO)
export async function getBatchesForPicking(
  productId: string,
  _quantity: number,
  allocationMethod: 'FIFO' | 'FEFO' | 'LIFO' = 'FIFO'
) {
  const batches = await getBatchesForProduct(productId);
  if (batches.error || !batches.data) return batches;

  const now = new Date();
  let availableBatches = batches.data.filter(b => b.quantity_available > 0);

  // Check for expired batches - prevent picking
  availableBatches = availableBatches.filter(b => {
    if (!b.expiration_date) return true;
    return new Date(b.expiration_date) > now;
  });

  // Sort based on allocation method
  if (allocationMethod === 'FIFO') {
    // First In First Out - oldest batch first
    availableBatches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (allocationMethod === 'FEFO') {
    // First Expired First Out - expires soonest first
    availableBatches.sort((a, b) => {
      const aExp = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
      const bExp = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
      return aExp - bExp;
    });
  } else if (allocationMethod === 'LIFO') {
    // Last In First Out - newest batch first
    availableBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return {
    data: availableBatches,
    error: null,
  };
}

/**
 * Returns the receipt date of the oldest stock still unconsumed, using FIFO simulation.
 * For batch-tracked products: oldest batch with quantity_available > 0.
 * For non-batch products: simulates FIFO over PO receipts vs current on-hand qty.
 */
export async function getOldestUnconsumedStockDate(
  productId: string,
  quantityOnHand: number
): Promise<{ data: string | null; isBatch: boolean; batchNumber?: string; allocationMethod?: string; error: null }> {
  const { shouldTrack, allocationMethod } = await shouldTrackBatchesForProduct(productId);

  if (shouldTrack) {
    const batchesRes = await getBatchesForProduct(productId);
    if (!batchesRes.error && Array.isArray(batchesRes.data) && batchesRes.data.length > 0) {
      const available = batchesRes.data.filter((b: any) => (b.quantity_available ?? 0) > 0);

      let next: any = null;
      if (allocationMethod === 'LIFO') {
        // Newest first
        next = available.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
      } else if (allocationMethod === 'FEFO') {
        // Soonest expiry first; batches with no expiry go last
        next = available.sort((a: any, b: any) => {
          const aExp = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
          const bExp = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
          return aExp - bExp;
        })[0];
      } else {
        // FIFO — oldest first
        next = available.sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0];
      }

      if (next) {
        return {
          data: allocationMethod === 'FEFO' ? (next.expiration_date || next.created_at) : next.created_at,
          isBatch: true,
          batchNumber: next.batch_number,
          allocationMethod,
          error: null,
        };
      }
    }
    return { data: null, isBatch: true, allocationMethod, error: null };
  }

  // Non-batch: simulate from PO receipts (pool — no order enforced)
  const receiptsRes = await getProductPOReceipts(productId);
  if (receiptsRes.error || !Array.isArray(receiptsRes.data) || receiptsRes.data.length === 0) {
    return { data: null, isBatch: false, error: null };
  }

  const receipts = receiptsRes.data
    .filter((r: any) => (r.quantity_received ?? 0) > 0)
    .sort((a: any, b: any) =>
      new Date(a.purchase_order?.order_date || a.created_at).getTime() -
      new Date(b.purchase_order?.order_date || b.created_at).getTime()
    );

  const totalReceived = receipts.reduce((sum: number, r: any) => sum + (r.quantity_received ?? 0), 0);
  const totalConsumed = Math.max(0, totalReceived - quantityOnHand);

  let cumulative = 0;
  for (const receipt of receipts) {
    cumulative += receipt.quantity_received ?? 0;
    if (cumulative > totalConsumed) {
      return {
        data: receipt.purchase_order?.order_date || receipt.created_at,
        isBatch: false,
        error: null,
      };
    }
  }

  return { data: null, isBatch: false, error: null };
}

// Generates the next sequential batch number in the format BAT-yymmdd-0001
export async function generateBatchNumber() {
  const companyId = getCurrentUserCompanyId();
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `BAT-${datePart}-`;

  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.PRODUCT_BATCHES}?company_id=eq.${companyId}&batch_number=like.${prefix}*&select=batch_number&order=batch_number.desc&limit=1`
  );

  let nextSeq = 1;
  const arr = Array.isArray(res.data) ? res.data : [];
  const last = arr[0]?.batch_number as string | undefined;
  const match = last?.match(/-(\d{4})$/);
  if (match?.[1]) nextSeq = parseInt(match[1], 10) + 1;

  return { data: `${prefix}${String(nextSeq).padStart(4, '0')}`, error: null };
}

// Create a batch when receiving goods
export async function createBatch(batchData: {
  product_id: string;
  batch_number: string;
  quantity_received: number;
  mfg_date?: string;
  expiration_date?: string;
  warehouse_id?: string;
  notes?: string;
}) {
  const companyId = getCurrentUserCompanyId();

  const payload = {
    ...batchData,
    // Postgres `date` columns reject empty strings — send null instead
    mfg_date: batchData.mfg_date || null,
    expiration_date: batchData.expiration_date || null,
    company_id: companyId,
    quantity_used: 0,
  };

  const response = await apiPost<ProductBatch>(API_ENDPOINTS.PRODUCT_BATCHES, payload);
  if (response.error) return response;

  return {
    data: JSON.parse(JSON.stringify(response.data)) as ProductBatch,
    error: null,
  };
}

// Update batch quantity when picking
export async function updateBatchUsedQuantity(
  batchId: string,
  quantityUsed: number
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<ProductBatch>(
    `${API_ENDPOINTS.PRODUCT_BATCHES}?id=eq.${batchId}&company_id=eq.${companyId}`,
    { quantity_used: quantityUsed }
  );

  if (response.error) return response;

  return {
    data: JSON.parse(JSON.stringify(response.data)) as ProductBatch,
    error: null,
  };
}

// Update batch details
export async function updateBatch(
  batchId: string,
  updates: Partial<Omit<ProductBatch, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'quantity_available'>>
) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<ProductBatch>(
    `${API_ENDPOINTS.PRODUCT_BATCHES}?id=eq.${batchId}&company_id=eq.${companyId}`,
    updates
  );

  if (response.error) return response;

  return {
    data: JSON.parse(JSON.stringify(response.data)) as ProductBatch,
    error: null,
  };
}

// Delete batch
export async function deleteBatch(batchId: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.PRODUCT_BATCHES}?id=eq.${batchId}&company_id=eq.${companyId}`);
}

// Check for expiring/expired batches
export async function getExpiringBatches(daysUntilExpiry: number = 7) {
  const companyId = getCurrentUserCompanyId();
  
  const response = await apiGet<ProductBatch[]>(
    `${API_ENDPOINTS.PRODUCT_BATCHES}?company_id=eq.${companyId}&order=expiration_date.asc`
  );

  if (response.error || !response.data) return response;

  const now = new Date();
  const expiryThreshold = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  const expiringBatches = response.data.filter(b => {
    if (!b.expiration_date) return false;
    const expDate = new Date(b.expiration_date);
    return expDate <= expiryThreshold && expDate > now && b.quantity_available > 0;
  });

  return {
    data: JSON.parse(JSON.stringify(expiringBatches)) as ProductBatch[],
    error: null,
  };
}

// Toggle batch tracking for a product (SME perspective: track expiry or not)
export async function updateProductBatchTracking(
  productId: string,
  trackBatches: boolean
) {
  const companyId = getCurrentUserCompanyId();
  const endpoint = process.env.NEXT_INV_PRODUCTS || API_ENDPOINTS.PRODUCTS;
  
  const response = await apiPatch<any>(
    `${endpoint}?id=eq.${productId}&company_id=eq.${companyId}`,
    { track_batches: trackBatches }
  );

  if (response.error) return response;

  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

// Check if product has batch tracking enabled
export async function shouldTrackBatchesForProduct(productId: string) {
  const companyId = getCurrentUserCompanyId();
  const endpoint = process.env.NEXT_INV_PRODUCTS || API_ENDPOINTS.PRODUCTS;
  
  const response = await apiGet<any[]>(
    `${endpoint}?id=eq.${productId}&company_id=eq.${companyId}` 
  );

  if (response.error || !response.data || response.data.length === 0) {
    return { shouldTrack: false, error: response.error };
  }

  const product = response.data[0];
  return {
    shouldTrack: product.track_batches === true,
    allocationMethod: (product.allocation_method as 'FIFO' | 'FEFO' | 'LIFO') || 'FIFO',
    error: null
  };
}

// Conditional receiving: create batch OR just update stock levels
export async function receiveGoods(
  productId: string,
  quantity: number,
  batchData?: {
    batch_number?: string;
    mfg_date?: string;
    expiration_date?: string;
    warehouse_id?: string;
    notes?: string;
  }
) {
  // Check if product has batch tracking enabled
  const { shouldTrack } = await shouldTrackBatchesForProduct(productId);

  if (shouldTrack && batchData?.batch_number) {
    // Create batch for tracked product
    const batchResult = await createBatch({
      product_id: productId,
      batch_number: batchData.batch_number,
      quantity_received: quantity,
      mfg_date: batchData.mfg_date,
      expiration_date: batchData.expiration_date,
      warehouse_id: batchData.warehouse_id,
      notes: batchData.notes,
    });

    if (batchResult.error) return batchResult;

    // Also update total stock levels for reporting
    await updateStockLevels(productId, quantity);

    return {
      data: {
        batch_id: batchResult.data?.id,
        quantity_received: quantity,
        batch_tracked: true,
      },
      error: null,
    };
  } else {
    // Just update stock levels for non-tracked products
    const result = await updateStockLevels(productId, quantity);
    
    return {
      data: {
        quantity_received: quantity,
        batch_tracked: false,
      },
      error: result.error,
    };
  }
}

export async function receiveGoodsWithRejection(
  productId: string,
  quantityAccepted: number,
  quantityRejected: number,
  batchData?: {
    batch_number?: string;
    mfg_date?: string;
    expiration_date?: string;
    warehouse_id?: string;
    notes?: string;
  },
  rejectionReason?: string,
  warehouseIdOverride?: string  // explicit warehouse — used when batch tracking is off
) {
  const companyId = getCurrentUserCompanyId();
  // Prefer the explicit override, then fall back to batchData.warehouse_id
  const warehouseId = warehouseIdOverride || batchData?.warehouse_id;

  try {
    // Update stock on hand with accepted quantity — scoped to the receiving warehouse
    if (quantityAccepted > 0) {
      await updateStockLevels(productId, quantityAccepted, warehouseId);
    }

    // Update rejected quantity
    if (quantityRejected > 0) {
      const stockResponse = await apiGet<any[]>(
        `${API_ENDPOINTS.STOCK_LEVELS}?product_id=eq.${productId}&company_id=eq.${companyId}${warehouseId ? `&warehouse_id=eq.${warehouseId}` : ''}`
      );

      if (stockResponse.data && Array.isArray(stockResponse.data) && stockResponse.data.length > 0) {
        const stockLevel = stockResponse.data[0];
        const newRejectionQty = Math.max(0, (stockLevel.quantity_rejected || 0) + quantityRejected);

        // Update stock levels with rejection
        await apiPatch<any>(
          `${API_ENDPOINTS.STOCK_LEVELS}?id=eq.${stockLevel.id}`,
          {
            quantity_rejected: newRejectionQty,
          }
        );
      } else if (quantityAccepted === 0) {
        // Create new stock level if no stock exists and items are only rejected
        await apiPost<any>(API_ENDPOINTS.STOCK_LEVELS, {
          company_id: companyId,
          product_id: productId,
          quantity_rejected: quantityRejected,
        });
      }

      // Create stock transaction for rejection
      await createStockTransaction({
        product_id: productId,
        transaction_type: 'rejected',
        quantity: quantityRejected,
        notes: rejectionReason || 'Items rejected during GRN receiving',
      });
    }

    // Handle batch tracking if enabled
    if (batchData?.batch_number && quantityAccepted > 0) {
      const { shouldTrack } = await shouldTrackBatchesForProduct(productId);
      if (shouldTrack) {
        const batchResult = await createBatch({
          product_id: productId,
          batch_number: batchData.batch_number,
          quantity_received: quantityAccepted,
          mfg_date: batchData.mfg_date,
          expiration_date: batchData.expiration_date,
          warehouse_id: batchData.warehouse_id,
          notes: batchData.notes,
        });
        if (batchResult.error) {
          return {
            data: null,
            error: { message: `Failed to create batch ${batchData.batch_number}: ${batchResult.error.message || JSON.stringify(batchResult.error)}` },
          };
        }
      }
    }

    return {
      data: {
        quantity_accepted: quantityAccepted,
        quantity_rejected: quantityRejected,
        total_received: quantityAccepted + quantityRejected,
        batch_tracked: !!batchData?.batch_number,
      },
      error: null,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error receiving goods with rejection:', err);
    return {
      data: null,
      error: { message: err.message },
    };
  }
}

// ============= NOTIFICATIONS =============

export async function getNotifications(limit = 50, offset = 0) {
  return apiGet<any[]>(API_ENDPOINTS.NOTIFICATIONS, {
    limit,
    offset,
  });
}

// ============= PRODUCT TYPES =============

export async function getProductTypes(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.PRODUCT_TYPES}?company_id=eq.${companyId}&order=sort_order.asc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function createProductType(data: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const dataWithCompany = {
    ...data,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.PRODUCT_TYPES, dataWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateProductType(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.PRODUCT_TYPES}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteProductType(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.PRODUCT_TYPES}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= WARRANTY TYPES =============

export async function getWarrantyTypes(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.WARRANTY_TYPES}?company_id=eq.${companyId}&order=sort_order.asc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function createWarrantyType(data: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const dataWithCompany = {
    ...data,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.WARRANTY_TYPES, dataWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateWarrantyType(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.WARRANTY_TYPES}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteWarrantyType(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.WARRANTY_TYPES}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= BRANDS =============

export async function getBrands(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.BRANDS}?company_id=eq.${companyId}&order=sort_order.asc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function createBrand(data: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const dataWithCompany = {
    ...data,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.BRANDS, dataWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateBrand(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.BRANDS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteBrand(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.BRANDS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= HANDLING INSTRUCTIONS =============

export async function getHandlingInstructions(limit = 100, offset = 0) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiGet<any[]>(`${API_ENDPOINTS.HANDLING_INSTRUCTIONS}?company_id=eq.${companyId}&order=sort_order.asc&limit=${limit}&offset=${offset}`);
  
  if (response.error) return response;
  
  return {
    data: JSON.parse(JSON.stringify(response.data)) as unknown as any[],
    error: null,
  };
}

export async function createHandlingInstruction(data: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const dataWithCompany = {
    ...data,
    company_id: companyId,
  };
  const response = await apiPost<any>(API_ENDPOINTS.HANDLING_INSTRUCTIONS, dataWithCompany);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function updateHandlingInstruction(id: string, updates: Record<string, unknown>) {
  const companyId = getCurrentUserCompanyId();
  const response = await apiPatch<any>(`${API_ENDPOINTS.HANDLING_INSTRUCTIONS}?id=eq.${id}&company_id=eq.${companyId}`, updates);
  if (response.error) return response;
  return {
    data: JSON.parse(JSON.stringify(response.data)),
    error: null,
  };
}

export async function deleteHandlingInstruction(id: string) {
  const companyId = getCurrentUserCompanyId();
  return apiDelete(`${API_ENDPOINTS.HANDLING_INSTRUCTIONS}?id=eq.${id}&company_id=eq.${companyId}`);
}

// ============= SUPERADMIN AUTH =============

export async function verifySuperadminLogin(
  username: string,
  password: string
): Promise<{ ok: boolean }> {
  const expectedUser = process.env.SUPERADMIN_USERNAME ?? process.env.superadmin;
  const expectedPass = process.env.SUPERADMIN_PASSWORD ?? process.env.sapword;
  if (!expectedUser || !expectedPass) {
    console.error('[SUPERADMIN] Credentials not configured in environment');
    return { ok: false };
  }
  return { ok: username === expectedUser && password === expectedPass };
}

// ============= SUBSCRIPTION BILLING =============

/**
 * Determine the current billing period start date for a company.
 * Billing day = day-of-month from company.created_at.
 * e.g. signed up May 15 → bills on the 15th every month.
 */
function getBillingPeriodStart(companyCreatedAt: string): Date {
  const signup = new Date(companyCreatedAt);
  const billingDay = Math.min(signup.getDate(), 28); // cap at 28 to handle short months
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // If today's day >= billingDay → current month is the billing period
  // Otherwise → last month
  if (now.getDate() >= billingDay) {
    return new Date(now.getFullYear(), now.getMonth(), billingDay);
  }
  return new Date(now.getFullYear(), now.getMonth() - 1, billingDay);
}

function subscriptionInvoiceNumber(companyName: string, periodStart: Date): string {
  const code = companyName.replace(/\s+/g, '').slice(0, 6).toUpperCase();
  const ym = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
  return `SUB-${code}-${ym}`;
}

/**
 * Generate a subscription invoice for ONE company if not already billed this period.
 * Returns 'created' | 'already_billed' | 'skipped' | 'error'.
 */
export async function generateSubscriptionInvoice(company: {
  id: string;
  name: string;
  plan_type: string;
  created_at: string;
  currency_code?: string;
}): Promise<{ result: 'created' | 'already_billed' | 'skipped' | 'error'; error?: string }> {
  try {
    // Import plans dynamically to avoid circular issues
    const { PLANS } = await import('@/lib/plans');
    const plan = PLANS[company.plan_type];
    if (!plan || plan.price === 0) {
      return { result: 'skipped' }; // custom/free plan — skip auto-billing
    }

    const periodStart = getBillingPeriodStart(company.created_at);
    const invoiceNumber = subscriptionInvoiceNumber(company.name, periodStart);

    // Check if already billed this period
    const existing = await apiGet<any[]>(
      `${API_ENDPOINTS.INVOICES}?company_id=eq.${company.id}&invoice_number=eq.${encodeURIComponent(invoiceNumber)}&deleted_at=is.null`
    );
    if (!existing.error && Array.isArray(existing.data) && existing.data.length > 0) {
      return { result: 'already_billed' };
    }

    // Due date = billing period start + 15 days
    const dueDate = new Date(periodStart);
    dueDate.setDate(dueDate.getDate() + 15);

    const invoicePayload = {
      company_id: company.id,
      invoice_number: invoiceNumber,
      invoice_date: periodStart.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'pending',
      total_amount: plan.price,
      subtotal: plan.price,
      tax_total: 0,
      discount_total: 0,
      notes: `Monthly subscription — ${plan.label} Plan`,
      terms: `Payment due within 15 days of invoice date.`,
      // order_type intentionally omitted so it shows in the company invoice list
    };

    const res = await apiPost<any>(API_ENDPOINTS.INVOICES, invoicePayload);
    if (res.error) return { result: 'error', error: JSON.stringify(res.error) };

    return { result: 'created' };
  } catch (err: any) {
    return { result: 'error', error: err?.message };
  }
}

/**
 * Run subscription billing for ALL active companies.
 * Returns a summary: { created, already_billed, skipped, errors }
 */
export async function generateAllSubscriptionInvoices(): Promise<{
  created: number;
  already_billed: number;
  skipped: number;
  errors: number;
  details: { company: string; result: string; error?: string }[];
}> {
  const companiesRes = await apiGet<any[]>(
    `${API_ENDPOINTS.COMPANIES}?subscription_status=eq.active&status=eq.active&limit=500`
  );

  const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
  const summary = { created: 0, already_billed: 0, skipped: 0, errors: 0, details: [] as any[] };

  for (const company of companies) {
    const { result, error } = await generateSubscriptionInvoice(company);
    summary.details.push({ company: company.name, result, error });
    if (result === 'created') summary.created++;
    else if (result === 'already_billed') summary.already_billed++;
    else if (result === 'skipped') summary.skipped++;
    else summary.errors++;
  }

  return summary;
}

/**
 * Mark all past-due invoices as overdue.
 * Targets: pending, sent, partially_paid invoices where due_date < today.
 * Returns count of invoices updated.
 */
export async function markOverdueInvoices(): Promise<{ updated: number; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all unpaid invoices past their due date
    const res = await apiGet<any[]>(
      `${API_ENDPOINTS.INVOICES}?status=in.(pending,sent,partially_paid)&due_date=lt.${today}&deleted_at=is.null&limit=1000`
    );

    if (res.error || !Array.isArray(res.data)) {
      return { updated: 0, error: 'Failed to fetch invoices' };
    }

    const toMark = res.data;
    if (toMark.length === 0) return { updated: 0 };

    // Bulk update: PATCH all matching records at once
    const bulkRes = await apiPatch<any>(
      `${API_ENDPOINTS.INVOICES}?status=in.(pending,sent,partially_paid)&due_date=lt.${today}&deleted_at=is.null`,
      { status: 'overdue' }
    );

    if (bulkRes.error) return { updated: 0, error: JSON.stringify(bulkRes.error) };
    return { updated: toMark.length };
  } catch (err: any) {
    return { updated: 0, error: err?.message };
  }
}

// ============= SUPERADMIN BILLING =============

/**
 * Superadmin: mark an invoice as fully paid.
 * Sets status='paid', amount_paid=total_amount, and creates a payment record.
 */
export async function adminMarkInvoicePaid(
  invoiceId: string,
  paymentMethod: string = 'bank_transfer',
  notes: string = 'Marked as paid by system administrator'
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Fetch the invoice (no company scoping — superadmin action)
    const invRes = await apiGet<any[]>(`${API_ENDPOINTS.INVOICES}?id=eq.${invoiceId}`);
    if (invRes.error || !Array.isArray(invRes.data) || !invRes.data[0]) {
      return { ok: false, error: 'Invoice not found' };
    }
    const invoice = invRes.data[0];

    if (invoice.status === 'paid') {
      return { ok: false, error: 'Invoice is already marked as paid' };
    }

    const totalAmount = Number(invoice.total_amount) || 0;

    // Update invoice status and amount_paid
    const updateRes = await apiPatch<any>(`${API_ENDPOINTS.INVOICES}?id=eq.${invoiceId}`, {
      status: 'paid',
      amount_paid: totalAmount,
    });
    if (updateRes.error) {
      return { ok: false, error: 'Failed to update invoice status' };
    }

    // Create a payment record
    await apiPost<any>(API_ENDPOINTS.PAYMENTS, {
      invoice_id: invoiceId,
      company_id: invoice.company_id,
      amount: totalAmount,
      payment_method: paymentMethod,
      payment_date: new Date().toISOString().split('T')[0],
      notes,
      reference: `ADMIN-${invoiceId.slice(0, 8).toUpperCase()}`,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unexpected error' };
  }
}

/**
 * Superadmin: update an invoice's status (any status transition).
 */
export async function adminUpdateInvoiceStatus(
  invoiceId: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiPatch<any>(`${API_ENDPOINTS.INVOICES}?id=eq.${invoiceId}`, { status });
    if (res.error) return { ok: false, error: 'Failed to update status' };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unexpected error' };
  }
}

/**
 * Fetch all invoices across every company (superadmin only — no company scoping).
 * Returns enriched records with company name and customer name resolved.
 */
export async function getAllInvoicesForAdmin(limit = 500) {
  const [invoicesRes, companiesRes, customersRes, paymentsRes] = await Promise.all([
    apiGet<any[]>(`${API_ENDPOINTS.INVOICES}?deleted_at=is.null&order=due_date.asc&limit=${limit}`),
    apiGet<any[]>(`${API_ENDPOINTS.COMPANIES}?limit=500&select=id,name,email`),
    apiGet<any[]>(`${API_ENDPOINTS.CUSTOMERS}?limit=2000&select=id,name,company_id`),
    apiGet<any[]>(`${API_ENDPOINTS.PAYMENTS}?limit=2000&select=id,invoice_id,amount`),
  ]);

  const invoices = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
  const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
  const customers = Array.isArray(customersRes.data) ? customersRes.data : [];
  const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

  const companyMap = new Map(companies.map((c: any) => [c.id, c]));
  const customerMap = new Map(customers.map((c: any) => [c.id, c.name]));

  // Sum payments per invoice
  const paidByInvoice: Record<string, number> = {};
  payments.forEach((p: any) => {
    if (p.invoice_id) {
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (Number(p.amount) || 0);
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const enriched = invoices
    .filter((inv: any) => inv.order_type === 'sales_order' || !inv.order_type)
    .map((inv: any) => {
      const company = companyMap.get(inv.company_id) as any;
      const customerName = inv.customer_id ? (customerMap.get(inv.customer_id) ?? '—') : '—';
      const totalAmount = Number(inv.total_amount) || 0;
      const paidAmount = Number(inv.amount_paid ?? inv.paid_amount ?? paidByInvoice[inv.id] ?? 0);
      const outstanding = Math.max(0, totalAmount - paidAmount);
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate && inv.status !== 'paid'
        ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000)
        : 0;

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        company_id: inv.company_id,
        company_name: company?.name ?? '—',
        company_email: company?.email ?? '—',
        customer_name: customerName,
        status: inv.status,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        days_overdue: daysOverdue,
        created_at: inv.created_at,
      };
    });

  return { data: enriched, error: invoicesRes.error };
}

// ============= COMPANY EMAIL SETTINGS =============

export interface CompanyEmailSettings {
  id?: string;
  company_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_name: string;
  from_email: string;
  is_enabled: boolean;
  is_verified?: boolean;
  last_tested_at?: string;
}

export async function getCompanyEmailSettings(companyId: string) {
  const res = await apiGet<CompanyEmailSettings[]>(
    `${API_ENDPOINTS.COMPANY_EMAIL_SETTINGS}?company_id=eq.${companyId}&limit=1`
  );
  if (res.data && Array.isArray(res.data) && res.data.length > 0) {
    return { data: res.data[0], error: null };
  }
  return { data: null, error: res.error };
}

export async function saveCompanyEmailSettings(companyId: string, settings: Omit<CompanyEmailSettings, 'id' | 'company_id' | 'is_verified' | 'last_tested_at'>) {
  const existing = await apiGet<CompanyEmailSettings[]>(
    `${API_ENDPOINTS.COMPANY_EMAIL_SETTINGS}?company_id=eq.${companyId}&limit=1`
  );
  const hasExisting = existing.data && Array.isArray(existing.data) && existing.data.length > 0;

  if (hasExisting) {
    return apiPatch(
      `${API_ENDPOINTS.COMPANY_EMAIL_SETTINGS}?company_id=eq.${companyId}`,
      { ...settings, is_verified: false }
    );
  } else {
    return apiPost(API_ENDPOINTS.COMPANY_EMAIL_SETTINGS, {
      ...settings,
      company_id: companyId,
      is_verified: false,
    });
  }
}

export async function markEmailSettingsVerified(companyId: string) {
  return apiPatch(
    `${API_ENDPOINTS.COMPANY_EMAIL_SETTINGS}?company_id=eq.${companyId}`,
    { is_verified: true, last_tested_at: new Date().toISOString() }
  );
}

// ============= USER WAREHOUSE ASSIGNMENTS =============

/** Returns warehouse IDs assigned to a user. Empty array = access to all. */
export async function getUserWarehouseAssignments(userId: string): Promise<{ data: string[]; error: any }> {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<{ warehouse_id: string }[]>(
    `${API_ENDPOINTS.USER_WAREHOUSES}?user_id=eq.${userId}&company_id=eq.${companyId}&select=warehouse_id`
  );
  if (res.error) return { data: [], error: res.error };
  const list = Array.isArray(res.data) ? res.data : [];
  return { data: list.map((r) => r.warehouse_id), error: null };
}

/** Replace all warehouse assignments for a user (deletes existing, inserts new). */
export async function setUserWarehouseAssignments(
  userId: string,
  warehouseIds: string[]
): Promise<{ error: any }> {
  const companyId = getCurrentUserCompanyId();

  // Delete existing
  const del = await apiDelete(
    `${API_ENDPOINTS.USER_WAREHOUSES}?user_id=eq.${userId}&company_id=eq.${companyId}`
  );
  if (del.error) return { error: del.error };

  // Insert new rows (if any)
  if (warehouseIds.length === 0) return { error: null };

  const rows = warehouseIds.map((wid) => ({
    user_id: userId,
    warehouse_id: wid,
    company_id: companyId,
  }));

  const ins = await apiPost(API_ENDPOINTS.USER_WAREHOUSES, rows);
  return { error: ins.error ?? null };
}

/** Fetch all users with their assigned warehouses in one call (for the user list). */
export async function getUsersWithWarehouseAssignments(): Promise<{
  data: { user_id: string; warehouse_id: string }[];
  error: any;
}> {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<{ user_id: string; warehouse_id: string }[]>(
    `${API_ENDPOINTS.USER_WAREHOUSES}?company_id=eq.${companyId}&select=user_id,warehouse_id`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: Array.isArray(res.data) ? res.data : [], error: null };
}

// ============================================================
// PRODUCTION WORKFLOW — MATERIAL REQUEST FORMS (MRF)
// ============================================================

export async function getProductPOReceipts(productId: string) {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.PURCHASE_ORDER_ITEMS}?product_id=eq.${productId}&quantity_received=gt.0&select=*,purchase_order:purchase_orders(po_number,status,order_date,created_at,company_id,mrf_id,material_request:material_requests(mrf_number))&order=created_at.desc`
  );
  if (res.error || !Array.isArray(res.data)) return { data: [], error: res.error };
  const filtered = res.data.filter((r: any) => r.purchase_order?.company_id === companyId);
  return { data: JSON.parse(JSON.stringify(filtered)), error: null };
}

export async function getProductMRFRequests(productId: string) {
  const itemsRes = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_REQUEST_ITEMS}?product_id=eq.${productId}&select=*,material_request:material_requests(mrf_number,status,urgency_level,created_at,requestor_user_id,purchase_orders(po_number))`
  );
  if (itemsRes.error || !Array.isArray(itemsRes.data)) return { data: [], error: itemsRes.error };
  return { data: JSON.parse(JSON.stringify(itemsRes.data)), error: null };
}

export async function getProductMISItems(productId: string) {
  const itemsRes = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS}?product_id=eq.${productId}&select=*,material_issue_slip:material_issue_slips(mis_number,status,created_at,job_order_id)`
  );
  if (itemsRes.error || !Array.isArray(itemsRes.data)) return { data: [], error: itemsRes.error };
  return { data: JSON.parse(JSON.stringify(itemsRes.data)), error: null };
}

/** Map of product_id -> supplier_id, derived from the most recent purchase order that included the product. Used for "consumed per supplier" reporting since products don't carry a direct supplier_id. */
export async function getProductSupplierMap() {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.PURCHASE_ORDER_ITEMS}?product_id=not.is.null&select=product_id,purchase_order:purchase_orders(supplier_id,company_id,order_date,created_at)&order=created_at.desc&limit=5000`
  );
  if (res.error || !Array.isArray(res.data)) return { data: {}, error: res.error };
  const map: Record<string, string> = {};
  for (const r of res.data) {
    const po = r.purchase_order;
    if (po?.company_id === companyId && po?.supplier_id && r.product_id && !map[r.product_id]) {
      map[r.product_id] = po.supplier_id;
    }
  }
  return { data: map, error: null };
}

/** All MRF line items for the company, with MRF header and product info embedded — for the Material Requests report. */
export async function getMaterialRequestItemsForReport() {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_REQUEST_ITEMS}?select=*,material_request:material_requests(mrf_number,status,urgency_level,created_at,approved_at,company_id),product:products(name,sku,unit_of_measure,purchase_price,cost_price)&order=created_at.desc&limit=5000`
  );
  if (res.error || !Array.isArray(res.data)) return { data: [], error: res.error };
  const filtered = res.data.filter((r: any) => r.material_request?.company_id === companyId);
  return { data: JSON.parse(JSON.stringify(filtered)), error: null };
}

/** All MIS line items for the company, with MIS header and product info embedded — for the Material Issue Slips and supplier-consumption reports. */
export async function getMaterialIssueSlipItemsForReport() {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS}?select=*,material_issue_slip:material_issue_slips(mis_number,status,issued_at,created_at,job_order_id,company_id),product:products(name,sku,unit_of_measure,cost_price)&order=created_at.desc&limit=5000`
  );
  if (res.error || !Array.isArray(res.data)) return { data: [], error: res.error };
  const filtered = res.data.filter((r: any) => r.material_issue_slip?.company_id === companyId);
  return { data: JSON.parse(JSON.stringify(filtered)), error: null };
}

export async function getMaterialReturnSlipItemsForReport() {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_RETURN_SLIP_ITEMS}?select=*,material_return_slip:material_return_slips(mrs_number,status,job_order_id,returned_at,created_at,company_id),product:products(name,sku,unit_of_measure,cost_price)&order=created_at.desc&limit=5000`
  );
  if (res.error || !Array.isArray(res.data)) return { data: [], error: res.error };
  const filtered = res.data.filter((r: any) => r.material_return_slip?.company_id === companyId);
  return { data: JSON.parse(JSON.stringify(filtered)), error: null };
}

export async function getMaterialRequests(status?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.MATERIAL_REQUESTS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc&select=*,job_order:job_orders(id,jo_number,title)`;
  if (status) url += `&status=eq.${status}`;
  const res = await apiGet<any[]>(url);
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

/** All Job Order MRF (BOM adjustment) requests across job orders, for the unified Material Requests list. */
export async function getJobOrderMRFRequests(status?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?company_id=eq.${companyId}&order=created_at.desc&select=*,product:products(id,name,sku),job_order:job_orders(id,jo_number,title)`;
  if (status) url += `&status=eq.${status}`;
  const res = await apiGet<any[]>(url);
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function getMaterialRequestById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_REQUESTS}?id=eq.${id}&company_id=eq.${companyId}&deleted_at=is.null&select=*,job_order:job_orders(id,jo_number,title)`
  );
  if (res.error) return { data: null, error: res.error };
  const arr = Array.isArray(res.data) ? res.data : [];
  return { data: arr.length > 0 ? JSON.parse(JSON.stringify(arr[0])) : null, error: null };
}

export async function getMaterialRequestItems(mrfId: string) {
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_REQUEST_ITEMS}?material_request_id=eq.${mrfId}&order=created_at.asc&select=*,product:products(id,name,sku,unit_of_measure,purchase_price,cost_price,supplier_id)`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function createPOFromMRF(
  mrfId: string,
  supplierId: string,
  warehouseId?: string,
  itemIds?: string[]   // if provided, only these MRF item IDs are included
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const now = new Date();
  const poNumberResult = await generatePoNumber();
  const poNumber = poNumberResult.data as string;

  const itemsRes = await getMaterialRequestItems(mrfId);
  if (itemsRes.error || !Array.isArray(itemsRes.data) || itemsRes.data.length === 0) {
    return { error: 'Failed to load MRF items', data: null };
  }

  const allItems = itemsRes.data;
  const items = itemIds ? allItems.filter((i: any) => itemIds.includes(i.id)) : allItems;
  if (items.length === 0) return { error: 'No items selected', data: null };

  const subtotal = items.reduce((sum: number, i: any) => {
    const price = Number(i.product?.purchase_price || i.product?.cost_price || 0);
    return sum + Number(i.quantity_requested) * price;
  }, 0);

  const po = await apiPost<any>(API_ENDPOINTS.PURCHASE_ORDERS, {
    company_id: companyId,
    supplier_id: supplierId,
    mrf_id: mrfId,
    requested_by_id: userId,
    status: 'draft',
    po_number: poNumber,
    order_date: now.toISOString().split('T')[0],
    warehouse_id: warehouseId || null,
    subtotal,
    tax_amount: 0,
    total_amount: subtotal,
    notes: `Auto-generated from MRF`,
  });

  if (po.error) return { error: 'Failed to create PO', data: null };

  const poId = Array.isArray(po.data) ? po.data[0]?.id : po.data?.id;
  if (!poId) return { error: 'PO created but ID missing', data: null };

  for (const item of items) {
    const unitPrice = Number(item.product?.purchase_price || item.product?.cost_price || 0);
    await apiPost<any>(API_ENDPOINTS.PURCHASE_ORDER_ITEMS, {
      purchase_order_id: poId,
      product_id: item.product_id || null,
      description: item.product?.name || 'Item',
      quantity_ordered: Number(item.quantity_requested),
      unit_price: unitPrice,
      tax_rate: 0,
      discount_percent: 0,
      warehouse_id: warehouseId || null,
    });
  }

  return { data: { id: poId, po_number: poNumber }, error: null };
}

export async function createMaterialRequest(
  data: { urgency_level: string; notes?: string; job_order_id?: string },
  items: { product_id: string; quantity_requested: number; notes?: string }[]
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const mrfNumber = await generateDailyDocNumber(API_ENDPOINTS.MATERIAL_REQUESTS, 'mrf_number', 'PO-MRF', companyId);

  const headerRes = await apiPost<any>(API_ENDPOINTS.MATERIAL_REQUESTS, {
    company_id: companyId,
    mrf_number: mrfNumber,
    status: 'pending_approval',
    urgency_level: data.urgency_level || 'normal',
    notes: data.notes || null,
    requestor_user_id: userId,
    job_order_id: data.job_order_id || null,
  });
  if (headerRes.error) return { data: null, error: headerRes.error };
  const header = Array.isArray(headerRes.data) ? headerRes.data[0] : headerRes.data;
  if (!header?.id) return { data: null, error: { message: 'Failed to create MRF header' } };

  for (const item of items) {
    await apiPost<any>(API_ENDPOINTS.MATERIAL_REQUEST_ITEMS, {
      material_request_id: header.id,
      product_id: item.product_id,
      quantity_requested: item.quantity_requested,
      notes: item.notes || null,
    });
  }
  return { data: JSON.parse(JSON.stringify(header)), error: null };
}

export async function updateMaterialRequestStatus(
  id: string,
  status: 'pending_approval' | 'approved' | 'rejected' | 'cancelled',
  options?: { rejection_reason?: string }
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') {
    updates.approved_by_user_id = userId;
    updates.approved_at = new Date().toISOString();
  }
  if (status === 'rejected' && options?.rejection_reason) {
    updates.rejection_reason = options.rejection_reason;
  }
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.MATERIAL_REQUESTS}?id=eq.${id}&company_id=eq.${companyId}`,
    updates
  );
  if (res.error) return { data: null, error: res.error };
  return { data: JSON.parse(JSON.stringify(res.data)), error: null };
}

// ============================================================
// PRODUCTION WORKFLOW — JOB ORDERS (JO) + BOM
// ============================================================

export async function getJobOrders(status?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.JOB_ORDERS}?company_id=eq.${companyId}&deleted_at=is.null&order=created_at.desc`;
  if (status) url += `&status=eq.${status}`;
  const res = await apiGet<any[]>(url);
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function getJobOrderById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.JOB_ORDERS}?id=eq.${id}&company_id=eq.${companyId}&deleted_at=is.null`
  );
  if (res.error) return { data: null, error: res.error };
  const arr = Array.isArray(res.data) ? res.data : [];
  return { data: arr.length > 0 ? JSON.parse(JSON.stringify(arr[0])) : null, error: null };
}

export async function getStockLevelsForProducts(productIds: string[], warehouseId: string) {
  const companyId = getCurrentUserCompanyId();
  if (productIds.length === 0) return { data: [], error: null };
  const idsList = productIds.join(',');
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.STOCK_LEVELS}?company_id=eq.${companyId}&warehouse_id=eq.${warehouseId}&product_id=in.(${idsList})&select=product_id,quantity_on_hand,quantity_allocated,quantity_available`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function getJobOrderBOM(joId: string) {
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.JOB_ORDER_BOM}?job_order_id=eq.${joId}&order=created_at.asc&select=*,product:products(id,name,sku,unit_of_measure,bin_location_id)`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

/** Issue/return history for a single BOM line — used to trace repeat requests for the same item on a JO. */
export async function getJobOrderBOMItemHistory(bomItemId: string) {
  const [issuesRes, returnsRes] = await Promise.all([
    apiGet<any[]>(
      `${API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS}?job_order_bom_id=eq.${bomItemId}&order=created_at.asc&select=*,material_issue_slip:material_issue_slips(mis_number,status,issued_at,received_by_user_id)`
    ),
    apiGet<any[]>(
      `${API_ENDPOINTS.MATERIAL_RETURN_SLIP_ITEMS}?job_order_bom_id=eq.${bomItemId}&order=created_at.asc&select=*,material_return_slip:material_return_slips(mrs_number,status,returned_at,returned_by_user_id)`
    ),
  ]);
  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
  const returns = Array.isArray(returnsRes.data) ? returnsRes.data : [];
  return { data: JSON.parse(JSON.stringify({ issues, returns })), error: null };
}

// ============================================================
// JOB ORDER BOM CHANGE REQUESTS (Requestor → Processor/Admin approval)
// ============================================================

export async function getJobOrderBOMRequests(joId: string) {
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?job_order_id=eq.${joId}&order=created_at.desc&select=*,product:products(id,name,sku,unit_of_measure)`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function createJobOrderBOMRequest(
  joId: string,
  productId: string,
  requestedQuantity: number,
  options?: { jobOrderBomId?: string; currentQuantity?: number; reason?: string }
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const requestNumber = await generateDailyDocNumber(API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS, 'request_number', 'JO-MRF', companyId);
  const res = await apiPost<any>(API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS, {
    company_id: companyId,
    job_order_id: joId,
    job_order_bom_id: options?.jobOrderBomId || null,
    request_number: requestNumber,
    product_id: productId,
    current_quantity: options?.currentQuantity ?? null,
    requested_quantity: requestedQuantity,
    reason: options?.reason || null,
    status: 'pending_approval',
    requested_by_user_id: userId,
  });
  if (res.error) return { data: null, error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data[0] : res.data)), error: null };
}

/** Approve a BOM change request: applies the requested quantity to the BOM (adding a new line if needed). */
export async function approveJobOrderBOMRequest(requestId: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();

  const reqRes = await apiGet<any[]>(`${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?id=eq.${requestId}&company_id=eq.${companyId}`);
  const request = Array.isArray(reqRes.data) ? reqRes.data[0] : null;
  if (!request) return { error: { message: 'Request not found' } };

  if (request.job_order_bom_id) {
    const bomRes = await apiGet<any[]>(`${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${request.job_order_bom_id}`);
    const bomItem = Array.isArray(bomRes.data) ? bomRes.data[0] : null;
    if (!bomItem) return { error: { message: 'BOM item not found' } };
    const newQty = Number(bomItem.quantity_required || 0) + Number(request.requested_quantity);
    const upd = await updateJobOrderBOMItem(request.job_order_bom_id, newQty);
    if (upd.error) return { error: upd.error };
  } else {
    const add = await addJobOrderBOMItem(request.job_order_id, request.product_id, Number(request.requested_quantity));
    if (add.error) return { error: add.error };
  }

  // Reserve the approved quantity against the job order's warehouse stock
  // so the Inventory page reflects materials committed to this job order.
  const joRes = await apiGet<any[]>(`${API_ENDPOINTS.JOB_ORDERS}?id=eq.${request.job_order_id}&company_id=eq.${companyId}&select=warehouse_id`);
  const jobOrder = Array.isArray(joRes.data) ? joRes.data[0] : null;
  await updateStockReservation(request.product_id, Number(request.requested_quantity), jobOrder?.warehouse_id);

  const res = await apiPatch<any>(
    `${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?id=eq.${requestId}&company_id=eq.${companyId}`,
    { status: 'approved', approved_by_user_id: userId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

/** Cancel a pending BOM adjustment request. Only the requestor can cancel their own pending request. */
export async function cancelJobOrderBOMRequest(requestId: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const res = await apiDelete(
    `${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?id=eq.${requestId}&company_id=eq.${companyId}&status=eq.pending_approval&requested_by_user_id=eq.${userId}`
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

export async function rejectJobOrderBOMRequest(requestId: string, rejectionReason?: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.JOB_ORDER_BOM_REQUESTS}?id=eq.${requestId}&company_id=eq.${companyId}`,
    {
      status: 'rejected',
      approved_by_user_id: userId,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString(),
    }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

export async function addJobOrderBOMItem(
  joId: string,
  productId: string,
  quantityRequired: number,
  notes?: string
) {
  const res = await apiPost<any>(API_ENDPOINTS.JOB_ORDER_BOM, {
    job_order_id: joId,
    product_id: productId,
    quantity_required: quantityRequired,
    notes: notes || null,
  });
  if (res.error) return { data: null, error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data[0] : res.data)), error: null };
}

export async function removeJobOrderBOMItem(bomItemId: string) {
  return apiDelete(`${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${bomItemId}`);
}

export async function updateJobOrderBOMItem(bomItemId: string, quantityRequired: number) {
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${bomItemId}`,
    { quantity_required: quantityRequired }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

export async function createJobOrder(
  data: {
    title: string;
    description?: string;
    priority?: string;
    customer_id?: string;
    sales_order_id?: string;
    production_lead?: string;
    start_date?: string;
    target_completion_date?: string;
    warehouse_id?: string;
    notes?: string;
  },
  bomItems: { product_id: string; quantity_required: number; notes?: string }[]
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const joNumber = await generateDailyDocNumber(API_ENDPOINTS.JOB_ORDERS, 'jo_number', 'JO', companyId);

  const headerRes = await apiPost<any>(API_ENDPOINTS.JOB_ORDERS, {
    company_id: companyId,
    jo_number: joNumber,
    title: data.title,
    description: data.description || null,
    status: 'pending_approval',
    priority: data.priority || 'normal',
    customer_id: data.customer_id || null,
    sales_order_id: data.sales_order_id || null,
    production_lead: data.production_lead || null,
    start_date: data.start_date || null,
    target_completion_date: data.target_completion_date || null,
    warehouse_id: data.warehouse_id || null,
    notes: data.notes || null,
    created_by_user_id: userId,
  });
  if (headerRes.error) return { data: null, error: headerRes.error };
  const header = Array.isArray(headerRes.data) ? headerRes.data[0] : headerRes.data;
  if (!header?.id) return { data: null, error: { message: 'Failed to create Job Order header' } };

  for (const item of bomItems) {
    await apiPost<any>(API_ENDPOINTS.JOB_ORDER_BOM, {
      job_order_id: header.id,
      product_id: item.product_id,
      quantity_required: item.quantity_required,
      notes: item.notes || null,
    });
  }
  return { data: JSON.parse(JSON.stringify(header)), error: null };
}

export async function updateJobOrderStatus(
  id: string,
  status: 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') {
    updates.approved_by_user_id = userId;
    updates.approved_at = new Date().toISOString();
  }
  if (status === 'completed') {
    updates.actual_completion_date = new Date().toISOString().split('T')[0];
  }
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.JOB_ORDERS}?id=eq.${id}&company_id=eq.${companyId}`,
    updates
  );
  if (res.error) return { data: null, error: res.error };
  return { data: JSON.parse(JSON.stringify(res.data)), error: null };
}

// ============================================================
// PRODUCTION WORKFLOW — MATERIAL ISSUE SLIPS (MIS)
// ============================================================

export async function getMaterialIssueSlips(joId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.MATERIAL_ISSUE_SLIPS}?company_id=eq.${companyId}&order=created_at.desc`;
  if (joId) url += `&job_order_id=eq.${joId}`;
  const res = await apiGet<any[]>(url);
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function getMaterialIssueSlipById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIPS}?id=eq.${id}&company_id=eq.${companyId}`
  );
  if (res.error) return { data: null, error: res.error };
  const arr = Array.isArray(res.data) ? res.data : [];
  return { data: arr.length > 0 ? JSON.parse(JSON.stringify(arr[0])) : null, error: null };
}

export async function getMaterialIssueSlipItems(misId: string) {
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS}?material_issue_slip_id=eq.${misId}&order=created_at.asc`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function createMaterialIssueSlip(
  joId: string,
  warehouseId: string | undefined,
  items: { product_id: string; job_order_bom_id?: string; quantity_issued: number; bin_location_id?: string; notes?: string }[],
  issuedAt?: string
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const now = new Date();
  const misNumber = await generateDailyDocNumber(API_ENDPOINTS.MATERIAL_ISSUE_SLIPS, 'mis_number', 'MIS', companyId);

  const headerRes = await apiPost<any>(API_ENDPOINTS.MATERIAL_ISSUE_SLIPS, {
    company_id: companyId,
    mis_number: misNumber,
    job_order_id: joId,
    status: 'draft',
    issued_by_user_id: userId,
    warehouse_id: warehouseId || null,
    issued_at: issuedAt || now.toISOString(),
  });
  if (headerRes.error) return { data: null, error: headerRes.error };
  const header = Array.isArray(headerRes.data) ? headerRes.data[0] : headerRes.data;
  if (!header?.id) return { data: null, error: { message: 'Failed to create MIS header' } };

  for (const item of items) {
    if (item.quantity_issued <= 0) continue;
    await apiPost<any>(API_ENDPOINTS.MATERIAL_ISSUE_SLIP_ITEMS, {
      material_issue_slip_id: header.id,
      job_order_bom_id: item.job_order_bom_id || null,
      product_id: item.product_id,
      quantity_issued: item.quantity_issued,
      bin_location_id: item.bin_location_id || null,
      notes: item.notes || null,
    });
  }
  return { data: JSON.parse(JSON.stringify(header)), error: null };
}

/** Issue materials: deduct stock, create transactions, update BOM quantities. */
export async function issueMaterials(misId: string, receivedByUserId: string) {
  const companyId = getCurrentUserCompanyId();

  // Load MIS and its items
  const [misRes, itemsRes] = await Promise.all([
    getMaterialIssueSlipById(misId),
    getMaterialIssueSlipItems(misId),
  ]);
  if (misRes.error || !misRes.data) return { error: misRes.error || { message: 'MIS not found' } };
  const mis = misRes.data;
  const items: any[] = Array.isArray(itemsRes.data) ? itemsRes.data : [];

  // Deduct stock and log transactions for each item
  for (const item of items) {
    if (!item.product_id || item.quantity_issued <= 0) continue;

    // Batch allocation (FIFO / FEFO / LIFO) for batch-tracked products
    const { shouldTrack, allocationMethod } = await shouldTrackBatchesForProduct(item.product_id);
    let transactionNotes = `Issued via MIS ${mis.mis_number} for Job Order`;

    if (shouldTrack) {
      const batchesRes = await getBatchesForPicking(item.product_id, item.quantity_issued, allocationMethod);
      const batches = batchesRes.data ?? [];
      let remaining = item.quantity_issued;
      const consumed: string[] = [];

      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, batch.quantity_available);
        remaining -= deduct;
        consumed.push(`${batch.batch_number}×${deduct}`);
        await apiPatch<any>(
          `${API_ENDPOINTS.PRODUCT_BATCHES}?id=eq.${batch.id}&company_id=eq.${companyId}`,
          {
            quantity_used: (batch.quantity_used || 0) + deduct,
            quantity_available: batch.quantity_available - deduct,
            updated_at: new Date().toISOString(),
          }
        );
      }

      if (consumed.length > 0) {
        transactionNotes = `Issued via MIS ${mis.mis_number} [${allocationMethod}: ${consumed.join(', ')}]`;
      }
    }

    // Deduct from stock_levels and release the matching reservation
    await updateStockLevelAtomic(item.product_id, -item.quantity_issued, -item.quantity_issued, mis.warehouse_id);

    // Deduct from bin_stock if bin assigned
    if (item.bin_location_id) {
      await updateBinStock(item.bin_location_id, item.product_id, -item.quantity_issued);
    }

    // Stock transaction audit trail
    await createStockTransaction({
      product_id: item.product_id,
      transaction_type: 'out',
      quantity: item.quantity_issued,
      notes: transactionNotes,
      reference_id: mis.id,
      reference_type: 'material_issue_slip',
    });

    // Update BOM quantity_issued
    if (item.job_order_bom_id) {
      const bomRes = await apiGet<any[]>(
        `${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${item.job_order_bom_id}`
      );
      const bom = Array.isArray(bomRes.data) ? bomRes.data[0] : null;
      if (bom) {
        await apiPatch<any>(`${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${item.job_order_bom_id}`, {
          quantity_issued: (bom.quantity_issued || 0) + item.quantity_issued,
        });
      }
    }
  }

  // Mark MIS as issued
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIPS}?id=eq.${misId}&company_id=eq.${companyId}`,
    {
      status: 'issued',
      issued_at: new Date().toISOString(),
      received_by_user_id: receivedByUserId,
      updated_at: new Date().toISOString(),
    }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

/** Production receiver acknowledges receipt of materials. */
export async function acknowledgeMIS(misId: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.MATERIAL_ISSUE_SLIPS}?id=eq.${misId}&company_id=eq.${companyId}`,
    {
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      received_by_user_id: userId,
      updated_at: new Date().toISOString(),
    }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}

// ============================================================
// PRODUCTION WORKFLOW — MATERIAL RETURN SLIPS (MRS)
// ============================================================

export async function getMaterialReturnSlips(joId?: string) {
  const companyId = getCurrentUserCompanyId();
  let url = `${API_ENDPOINTS.MATERIAL_RETURN_SLIPS}?company_id=eq.${companyId}&order=created_at.desc`;
  if (joId) url += `&job_order_id=eq.${joId}`;
  const res = await apiGet<any[]>(url);
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function getMaterialReturnSlipById(id: string) {
  const companyId = getCurrentUserCompanyId();
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_RETURN_SLIPS}?id=eq.${id}&company_id=eq.${companyId}`
  );
  if (res.error) return { data: null, error: res.error };
  const arr = Array.isArray(res.data) ? res.data : [];
  return { data: arr.length > 0 ? JSON.parse(JSON.stringify(arr[0])) : null, error: null };
}

export async function getMaterialReturnSlipItems(mrsId: string) {
  const res = await apiGet<any[]>(
    `${API_ENDPOINTS.MATERIAL_RETURN_SLIP_ITEMS}?material_return_slip_id=eq.${mrsId}&order=created_at.asc&select=*,product:products(id,name,sku)`
  );
  if (res.error) return { data: [], error: res.error };
  return { data: JSON.parse(JSON.stringify(Array.isArray(res.data) ? res.data : [])), error: null };
}

export async function createMaterialReturnSlip(
  joId: string,
  misId: string | undefined,
  warehouseId: string | undefined,
  items: {
    product_id: string;
    job_order_bom_id?: string;
    quantity_returned: number;
    condition: 'good' | 'damaged' | 'scrap';
    bin_location_id?: string;
    notes?: string;
  }[]
) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();
  const mrsNumber = await generateDailyDocNumber(API_ENDPOINTS.MATERIAL_RETURN_SLIPS, 'mrs_number', 'MRS', companyId);

  const headerRes = await apiPost<any>(API_ENDPOINTS.MATERIAL_RETURN_SLIPS, {
    company_id: companyId,
    mrs_number: mrsNumber,
    job_order_id: joId,
    material_issue_slip_id: misId || null,
    status: 'returned',
    returned_by_user_id: userId,
    returned_at: new Date().toISOString(),
    warehouse_id: warehouseId || null,
  });
  if (headerRes.error) return { data: null, error: headerRes.error };
  const header = Array.isArray(headerRes.data) ? headerRes.data[0] : headerRes.data;
  if (!header?.id) return { data: null, error: { message: 'Failed to create MRS header' } };

  for (const item of items) {
    if (item.quantity_returned <= 0) continue;
    await apiPost<any>(API_ENDPOINTS.MATERIAL_RETURN_SLIP_ITEMS, {
      material_return_slip_id: header.id,
      job_order_bom_id: item.job_order_bom_id || null,
      product_id: item.product_id,
      quantity_returned: item.quantity_returned,
      condition: item.condition,
      bin_location_id: item.bin_location_id || null,
      notes: item.notes || null,
    });
  }
  return { data: JSON.parse(JSON.stringify(header)), error: null };
}

/** Storekeeper restocks returned materials: add good/damaged stock back, log scrap. */
export async function restockReturnedMaterials(mrsId: string) {
  const companyId = getCurrentUserCompanyId();
  const userId = getCurrentUserId();

  const [mrsRes, itemsRes] = await Promise.all([
    getMaterialReturnSlipById(mrsId),
    getMaterialReturnSlipItems(mrsId),
  ]);
  if (mrsRes.error || !mrsRes.data) return { error: mrsRes.error || { message: 'MRS not found' } };
  const mrs = mrsRes.data;
  const items: any[] = Array.isArray(itemsRes.data) ? itemsRes.data : [];

  for (const item of items) {
    if (!item.product_id || item.quantity_returned <= 0) continue;

    if (item.condition === 'good' || item.condition === 'damaged') {
      // Add stock back
      await updateStockLevels(item.product_id, item.quantity_returned, mrs.warehouse_id);
      if (item.bin_location_id) {
        await updateBinStock(item.bin_location_id, item.product_id, item.quantity_returned);
      }
      await createStockTransaction({
        product_id: item.product_id,
        transaction_type: 'in',
        quantity: item.quantity_returned,
        notes: `Returned via MRS ${mrs.mrs_number} — condition: ${item.condition}`,
        reference_id: mrs.id,
        reference_type: 'material_return_slip',
      });
    } else if (item.condition === 'scrap') {
      // Log scrap write-off (stock was already removed on issue; just record it)
      await createStockTransaction({
        product_id: item.product_id,
        transaction_type: 'adjustment',
        quantity: -item.quantity_returned,
        notes: `Scrap write-off via MRS ${mrs.mrs_number}`,
        reference_id: mrs.id,
        reference_type: 'material_return_slip',
      });
    }

    // Update BOM tracking columns
    if (item.job_order_bom_id) {
      const bomRes = await apiGet<any[]>(
        `${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${item.job_order_bom_id}`
      );
      const bom = Array.isArray(bomRes.data) ? bomRes.data[0] : null;
      if (bom) {
        const updates: Record<string, unknown> = {};
        if (item.condition === 'good' || item.condition === 'damaged') {
          updates.quantity_returned = (bom.quantity_returned || 0) + item.quantity_returned;
        } else {
          updates.quantity_scrapped = (bom.quantity_scrapped || 0) + item.quantity_returned;
        }
        await apiPatch<any>(`${API_ENDPOINTS.JOB_ORDER_BOM}?id=eq.${item.job_order_bom_id}`, updates);
      }
    }
  }

  // Mark MRS as restocked
  const res = await apiPatch<any>(
    `${API_ENDPOINTS.MATERIAL_RETURN_SLIPS}?id=eq.${mrsId}&company_id=eq.${companyId}`,
    {
      status: 'restocked',
      restocked_at: new Date().toISOString(),
      received_by_user_id: userId,
      updated_at: new Date().toISOString(),
    }
  );
  if (res.error) return { error: res.error };
  return { error: null };
}
