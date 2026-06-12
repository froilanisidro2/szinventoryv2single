// User and Authentication Types
export interface User {
  id: string;
  email: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
  company_id: string;
  avatar?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  is_company_admin?: boolean;
  emailVerified?: boolean;
  created_at?: Date;
  updated_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserRole = 'super_admin' | 'company_admin' | 'admin' | 'manager' | 'staff' | 'viewer';

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  tax_id?: string;
  currency_code?: string;
  logo_url?: string;
  website?: string;
  status: 'active' | 'inactive' | 'suspended';
  user_limit: number; // SaaS: max users allowed
  active_users: number; // SaaS: current active users
  plan_type: 'starter' | 'professional' | 'enterprise'; // SaaS: pricing plan
  subscription_status: 'active' | 'paused' | 'cancelled';
  is_super_admin_company?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

// Product Types
export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  sku: string;
  category_id: string;
  unit_of_measure: string; // e.g., "pieces", "kg", "box"
  purchase_price?: number;
  selling_price: number;
  cost_price: number;
  reorder_level: number;
  reorder_quantity?: number;
  image_url?: string;
  tax_rate: number;
  warehouse_id?: string; // Default warehouse for putaway
  bin_location_id?: string; // Default bin location for putaway
  track_batches?: boolean; // Enable batch/lot tracking
  allocation_method?: 'FIFO' | 'FEFO' | 'LIFO'; // Batch allocation method when tracking enabled
  // Duration fields
  lead_time_days?: number; // Lead time in days for procurement
  shelf_life_days?: number; // Shelf life in days
  warranty_months?: number; // Warranty in months
  // Attributes fields
  weight?: string; // e.g., "5kg", "250g"
  dimension?: string; // e.g., "10x20x30cm"
  color?: string;
  size?: string;
  brand?: string;
  // Supplier link
  supplier_id?: string;
  // Classification fields
  product_type?: string; // e.g., "Consumable", "Equipment", "Raw Material", "Finished Good"
  // Handling fields
  shipping_instruction?: string; // e.g., "Hazard", "Fragile", "Liquid", "Keep Dry"
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string; // ISO string from DB
  updated_at: string; // ISO string from DB
  deleted_at?: string; // ISO string from DB
}

export interface Supplier {
  id: string;
  company_id: string;
  supplier_code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  tax_id?: string;
  contact_person?: string;
  business_category?: string;
  payment_terms?: string;
  vat_type?: 'vat' | 'non_vat';
  vat_rate?: number | null;
  notes?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Types
export interface Inventory {
  id: string;
  company_id: string;
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number;
  quantity_allocated: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  last_stock_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Customer Types
export interface Customer {
  id: string;
  company_id: string;
  customer_code: string;
  name: string;
  email?: string;
  phone?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  billing_postal_code?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_postal_code?: string;
  tax_id?: string;
  credit_limit?: number;
  current_balance?: number;
  contact_person?: string;
  business_category?: string;
  payment_terms?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Invoice Types
export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_id?: string;
  supplier_id?: string;
  order_type?: 'sales_order' | 'purchase_order';
  order_id?: string;
  invoice_date: Date;
  due_date: Date;
  status: 'draft' | 'pending' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  subtotal?: number;
  tax_total?: number;
  tax_amount?: number;
  discount_total?: number;
  total_amount?: number;
  amount_paid?: number;
  paid_amount?: number;
  notes?: string;
  terms?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

// GRN (Goods Received Note) Types
export interface GRN {
  id: string;
  company_id: string;
  grn_number: string;
  purchase_order_id: string;
  supplier_id: string;
  receipt_date: Date;
  received_by_id?: string;
  received_location?: string;
  total_items_ordered: number;
  total_items_received: number;
  total_items_accepted: number;
  total_items_rejected: number;
  quality_status: 'pending' | 'good' | 'partial' | 'rejected';
  inspection_notes?: string;
  approved_by_id?: string;
  approved_at?: Date;
  approval_signature?: string;
  status: 'draft' | 'submitted' | 'approved' | 'closed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GRNItem {
  id: string;
  grn_id: string;
  purchase_order_item_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  condition: 'good' | 'damaged' | 'partial';
  reason_for_rejection?: string;
  batch_number?: string;
  expiry_date?: Date;
  warehouse_id?: string;
  bin_location_id?: string;
  notes?: string;
}

// Payment Types
export interface Payment {
  id: string;
  company_id: string;
  invoice_id: string;
  amount: number;
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other';
  payment_date: Date;
  reference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Filter Types
export interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// Warehouse Types
export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  manager_name?: string;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Purchase Order Types
export interface PurchaseOrder {
  id: string;
  company_id: string;
  po_number: string;
  supplier_id: string;
  supplier?: Supplier;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  payment_terms?: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost?: number;
  total_amount: number;
  received_amount?: number;
  currency_code?: string;
  notes?: string;
  requested_by_id?: string;
  received_by_id?: string;
  items?: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
  sent_at?: string;
  canceled_at?: string;
  deleted_at?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id?: string;
  product?: Product;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted?: number;
  quantity_rejected?: number;
  unit_price: number;
  tax_rate: number;
  discount_percent?: number;
  line_total: number;
  sort_order?: number;
  notes?: string;
  warehouse_id?: string;
  bin_location_id?: string;
  rejection_reason?: string;
  qc_notes?: string;
  created_at: string;
  updated_at?: string;
}

// Stock Transfer Types
export interface StockTransfer {
  id: string;
  company_id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_date: string;
  received_date?: string;
  status: 'draft' | 'in_transit' | 'received' | 'cancelled';
  notes?: string;
  created_by_id?: string;
  received_by_id?: string;
  items?: StockTransferItem[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface StockTransferItem {
  id: string;
  stock_transfer_id: string;
  product_id: string;
  product?: Product;
  quantity_requested: number;
  quantity_received: number;
  notes?: string;
  created_at: string;
}

// Sales Orders Types
export interface SalesOrder {
  id: string;
  company_id: string;
  so_number: string;
  customer_id: string;
  customer?: Customer;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  allocation_method?: 'FIFO' | 'FEFO' | 'LIFO';
  status: 'draft' | 'confirmed' | 'picked' | 'partially_shipped' | 'shipped' | 'delivered' | 'cancelled';
  payment_terms?: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost?: number;
  total_amount: number;
  shipped_amount?: number;
  currency_code?: string;
  notes?: string;
  issued_by_id?: string;
  items?: SalesOrderItem[];
  created_at: string;
  updated_at: string;
  sent_at?: string;
  deleted_at?: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id?: string;
  product?: Product;
  description: string;
  quantity_ordered: number;
  quantity_picked?: number;
  quantity_shipped: number;
  unit_price: number;
  tax_rate: number;
  discount_percent?: number;
  line_total: number;
  sort_order?: number;
  notes?: string;
  warehouse_id?: string;
  bin_location_id?: string;
  quantity_damaged?: number;
  damage_reason?: string;
  shipment_notes?: string;
  picked_date?: string;
  picked_by_user_id?: string;
  actual_delivery_date?: string;
  updated_at?: string;
  created_at: string;
}

// ============================================================
// PRODUCTION WORKFLOW TYPES
// ============================================================

export interface MaterialRequest {
  id: string;
  company_id: string;
  mrf_number: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  urgency_level: 'low' | 'normal' | 'high' | 'critical';
  requestor_user_id?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  items?: MaterialRequestItem[];
  job_order_id?: string;
  job_order?: { id: string; jo_number: string; title: string };
}

export interface MaterialRequestItem {
  id: string;
  material_request_id: string;
  product_id?: string;
  product?: Product;
  quantity_requested: number;
  notes?: string;
  created_at: string;
}

export interface JobOrder {
  id: string;
  company_id: string;
  jo_number: string;
  title: string;
  description?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  customer_id?: string;
  customer?: Customer;
  sales_order_id?: string;
  production_lead?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  start_date?: string;
  target_completion_date?: string;
  actual_completion_date?: string;
  warehouse_id?: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  bom?: JobOrderBOMItem[];
}

export interface JobOrderBOMItem {
  id: string;
  job_order_id: string;
  product_id?: string;
  product?: Product;
  quantity_required: number;
  quantity_issued: number;
  quantity_returned: number;
  quantity_scrapped: number;
  notes?: string;
  created_at: string;
}

export interface MaterialIssueSlip {
  id: string;
  company_id: string;
  mis_number: string;
  job_order_id: string;
  status: 'draft' | 'issued' | 'acknowledged';
  issued_by_user_id?: string;
  received_by_user_id?: string;
  issued_at?: string;
  acknowledged_at?: string;
  warehouse_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: MaterialIssueSlipItem[];
}

export interface MaterialIssueSlipItem {
  id: string;
  material_issue_slip_id: string;
  job_order_bom_id?: string;
  product_id?: string;
  product?: Product;
  quantity_issued: number;
  bin_location_id?: string;
  notes?: string;
  created_at: string;
}

export interface MaterialReturnSlip {
  id: string;
  company_id: string;
  mrs_number: string;
  job_order_id: string;
  material_issue_slip_id?: string;
  status: 'draft' | 'returned' | 'restocked';
  returned_by_user_id?: string;
  received_by_user_id?: string;
  returned_at?: string;
  restocked_at?: string;
  warehouse_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: MaterialReturnSlipItem[];
}

export interface MaterialReturnSlipItem {
  id: string;
  material_return_slip_id: string;
  job_order_bom_id?: string;
  product_id?: string;
  product?: Product;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'scrap';
  bin_location_id?: string;
  notes?: string;
  created_at: string;
}
