-- =====================================================
-- SZ Inventory System - Database Schema (Consolidated)
-- For Small to Medium Enterprises (SMEs)
-- Includes all migrations up to 041
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. COMPANIES
-- =====================================================

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    tax_id VARCHAR(50) UNIQUE,
    currency_code VARCHAR(3) DEFAULT 'USD',
    logo_url TEXT,
    website VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    -- SaaS plan (migration 008)
    user_limit INT DEFAULT 5,
    active_users INT DEFAULT 0,
    plan_type VARCHAR(50) DEFAULT 'starter',
    subscription_status VARCHAR(50) DEFAULT 'active',
    is_super_admin_company BOOLEAN DEFAULT FALSE,
    -- Company details (migration 009)
    person_in_charge_name VARCHAR(255),
    person_in_charge_contact VARCHAR(20),
    business_type VARCHAR(100),
    company_address TEXT,
    tin_number VARCHAR(50),
    -- Batch allocation method (migration 012)
    allocation_method VARCHAR(50) DEFAULT 'FIFO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 2. ROLES
-- =====================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. USERS
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS users_code_seq START 1;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code INTEGER DEFAULT nextval('users_code_seq'),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    role VARCHAR(50) DEFAULT 'staff',
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    -- SaaS admin flag (migration 008)
    is_company_admin BOOLEAN DEFAULT FALSE,
    -- Password tracking (migration 010)
    password_is_temporary BOOLEAN DEFAULT FALSE,
    force_password_change BOOLEAN DEFAULT FALSE,
    last_password_change TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, email)
);

-- =====================================================
-- 4. USER SESSIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. PRODUCT CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- =====================================================
-- 6. UNIT OF MEASUREMENTS (migration 011)
-- =====================================================

CREATE TABLE IF NOT EXISTS unit_of_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- =====================================================
-- 7. WAREHOUSES
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS warehouses_code_seq START 1;

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code INTEGER DEFAULT nextval('warehouses_code_seq'),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(20),
    manager_name VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- =====================================================
-- 8. BIN LOCATIONS (migration 001, column renames from 020)
-- =====================================================

CREATE TABLE IF NOT EXISTS bin_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    location_name VARCHAR(255),
    zone VARCHAR(10),
    aisle VARCHAR(10),
    shelf VARCHAR(10),
    bin_number VARCHAR(10),
    capacity INTEGER DEFAULT 100,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    allocated_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (current_quantity - allocated_quantity) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (
        status IN ('available', 'reserved', 'maintenance', 'archived')
    ),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 9. PRODUCTS (base + migrations 013-016)
-- =====================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    unit_of_measure VARCHAR(50) DEFAULT 'piece',
    purchase_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(15, 2),
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    reorder_level INT DEFAULT 10,
    reorder_quantity INT DEFAULT 50,
    image_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    -- Batch tracking (migration 013)
    track_batches BOOLEAN DEFAULT FALSE,
    -- Per-product allocation method (migration 014)
    allocation_method VARCHAR(50) DEFAULT 'FIFO',
    -- Default putaway location (migration 015)
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    -- Extended properties: Duration (migration 016)
    lead_time_days INT,
    shelf_life_days INT,
    warranty_months INT,
    -- Extended properties: Attributes (migration 016)
    weight VARCHAR(100),
    dimension VARCHAR(100),
    color VARCHAR(100),
    size VARCHAR(100),
    brand VARCHAR(255),
    -- Extended properties: Classification & Handling (migration 016)
    product_type VARCHAR(100),
    shipping_instruction TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, sku)
);

-- =====================================================
-- 10. PRODUCT BATCHES (migration 012)
-- =====================================================

CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    mfg_date DATE,
    expiration_date DATE,
    quantity_received INT NOT NULL DEFAULT 0,
    quantity_used INT NOT NULL DEFAULT 0,
    quantity_available INT GENERATED ALWAYS AS (quantity_received - quantity_used) STORED,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, product_id, batch_number)
);

-- =====================================================
-- 11. PRODUCT PROPERTY REFERENCE TABLES (migration 017)
-- =====================================================

CREATE TABLE IF NOT EXISTS product_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS warranty_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    duration_months INT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS shelf_life_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    days_min INT NOT NULL,
    days_max INT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS handling_instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    symbol_code VARCHAR(10),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, name)
);

-- =====================================================
-- 12. STOCK LEVELS (base + migrations 001, 018, 020-021)
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    quantity_allocated INT NOT NULL DEFAULT 0,
    quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_allocated) STORED,
    -- Rejected quantity tracking (migration 018)
    quantity_rejected INTEGER NOT NULL DEFAULT 0,
    -- Scrapped quantity tracking (running total of items written off via disposition)
    quantity_scrapped INTEGER NOT NULL DEFAULT 0,
    warehouse_location VARCHAR(255),
    -- Bin location tracking (migration 001)
    bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    preferred_bin_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    last_stock_count TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, product_id),
    CONSTRAINT check_stock_levels_quantities CHECK (
        quantity_on_hand >= 0 AND
        quantity_allocated >= 0 AND
        quantity_rejected >= 0 AND
        quantity_scrapped >= 0
    )
);

-- =====================================================
-- 13. BIN STOCK (migration 001, column renames from 020)
-- =====================================================

CREATE TABLE IF NOT EXISTS bin_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bin_location_id UUID NOT NULL REFERENCES bin_locations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    allocated_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - allocated_quantity) STORED,
    last_count_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bin_location_id, product_id),
    UNIQUE(company_id, product_id, bin_location_id)
);

-- =====================================================
-- 14. STOCK TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    stock_level_id UUID REFERENCES stock_levels(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment', 'return', 'rejected'
    quantity INT NOT NULL,
    reference_type VARCHAR(50), -- 'invoice', 'purchase_order', 'adjustment'
    reference_id UUID,
    -- Warehouse link (migration 034)
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 15. CUSTOMERS (base + migrations 006, 009)
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    billing_address TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_country VARCHAR(100),
    billing_postal_code VARCHAR(20),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_country VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    tax_id VARCHAR(50),
    credit_limit DECIMAL(15, 2),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    contact_person VARCHAR(255),
    -- Business info (migration 006)
    business_category VARCHAR(50) DEFAULT 'manufacturing',
    -- Payment terms as string (migration 006, converted to varchar by 009)
    payment_terms VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, customer_code)
);

-- =====================================================
-- 16. SUPPLIERS (base + migrations 007, 009)
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS suppliers_code_seq START 1;

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code INTEGER DEFAULT nextval('suppliers_code_seq'),
    supplier_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    tax_id VARCHAR(50),
    contact_person VARCHAR(255),
    -- Business info (migration 007)
    business_category VARCHAR(50) DEFAULT 'manufacturing',
    -- Payment terms as string (migration 007, converted to varchar by 009)
    payment_terms VARCHAR(255),
    -- VAT classification (migration 033)
    vat_type VARCHAR(20) DEFAULT 'non_vat',
    vat_rate NUMERIC(5,2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, supplier_code)
);

-- =====================================================
-- 17. INVOICES (base + migration 006_enhance)
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    issued_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Order tracking (migration 006_enhance)
    order_type VARCHAR(50), -- 'sales_order', 'purchase_order'
    order_id UUID,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    order_date DATE,
    delivery_date DATE,
    billing_address TEXT,
    shipping_address TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'
    invoice_type VARCHAR(50) DEFAULT 'invoice', -- 'invoice', 'credit_note', 'debit_note'
    payment_terms VARCHAR(100),
    notes TEXT,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    shipping_cost DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    amount_due DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    currency_code VARCHAR(3) DEFAULT 'USD',
    custom_fields JSONB DEFAULT '{}',
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL, -- Warehouse link (migration 023)
    UNIQUE(company_id, invoice_number)
);

-- =====================================================
-- 18. INVOICE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(15, 4) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    line_total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_percent / 100) * (1 + tax_rate / 100)) STORED,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 19. PAYMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'bank_transfer', 'check', 'credit_card', 'crypto'
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_reference VARCHAR(255),
    notes TEXT,
    recorded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 20. PURCHASE ORDERS (base + migration 004)
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'
    payment_terms VARCHAR(100),
    notes TEXT,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    received_amount DECIMAL(15, 2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'USD',
    requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL, -- Warehouse link (migration 023)
    mrf_id UUID, -- Material Request origin; FK to material_requests added below (migration 040)
    UNIQUE(company_id, po_number)
);

-- =====================================================
-- 21. PURCHASE ORDER ITEMS (base + migration 004)
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity_ordered DECIMAL(15, 4) NOT NULL,
    quantity_received DECIMAL(15, 4) DEFAULT 0,
    unit_price DECIMAL(15, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    line_total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price * (1 - discount_percent / 100) * (1 + tax_rate / 100)) STORED,
    sort_order INT DEFAULT 0,
    notes TEXT,
    -- QC and receiving tracking (migration 004)
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    quantity_accepted DECIMAL(15, 4) DEFAULT 0,
    quantity_rejected DECIMAL(15, 4) DEFAULT 0,
    rejection_reason VARCHAR(255),
    qc_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 22. SALES ORDERS (schema_additions + migration 022)
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    so_number VARCHAR UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    issued_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status VARCHAR DEFAULT 'draft', -- 'draft', 'sent', 'confirmed', 'partially_shipped', 'shipped', 'delivered', 'cancelled'
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    shipping_cost NUMERIC DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'USD',
    payment_terms VARCHAR(50),
    notes TEXT,
    -- Allocation method (migration 022)
    allocation_method VARCHAR(10) DEFAULT 'FIFO' CHECK (allocation_method IN ('FIFO', 'FEFO', 'LIFO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL -- Warehouse link (migration 023)
);

-- =====================================================
-- 23. SALES ORDER ITEMS (schema_additions + migrations 005, 006_picking)
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    description VARCHAR NOT NULL,
    quantity_ordered DECIMAL(15, 4) NOT NULL,
    quantity_shipped DECIMAL(15, 4) DEFAULT 0,
    unit_price DECIMAL(15, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    line_total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price * (1 - discount_percent / 100) * (1 + tax_rate / 100)) STORED,
    sort_order INT DEFAULT 0,
    notes TEXT,
    -- Shipment tracking (migration 005)
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    quantity_damaged DECIMAL(15, 4) DEFAULT 0,
    damage_reason VARCHAR(255),
    shipment_notes TEXT,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    -- Picking tracking (migration 006_picking)
    quantity_picked DECIMAL(15, 4) DEFAULT 0,
    picked_date TIMESTAMP WITH TIME ZONE,
    picked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 24. GRN - GOODS RECEIVED NOTES (migration 007)
-- =====================================================

CREATE TABLE IF NOT EXISTS grn (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    grn_number VARCHAR(50) NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_location TEXT,
    total_items_ordered DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_items_received DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_items_accepted DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_items_rejected DECIMAL(15, 2) NOT NULL DEFAULT 0,
    quality_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'good', 'partial', 'rejected'
    inspection_notes TEXT,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_signature TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'closed'
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, grn_number)
);

CREATE TABLE IF NOT EXISTS grn_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_id UUID NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered DECIMAL(15, 2) NOT NULL,
    quantity_received DECIMAL(15, 2) NOT NULL DEFAULT 0,
    quantity_accepted DECIMAL(15, 2) NOT NULL DEFAULT 0,
    quantity_rejected DECIMAL(15, 2) NOT NULL DEFAULT 0,
    condition VARCHAR(50) DEFAULT 'good', -- 'good', 'damaged', 'partial'
    reason_for_rejection TEXT,
    batch_number VARCHAR(100),
    expiry_date DATE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 25. STOCK TRANSFERS (base + migration 001)
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transfer_number VARCHAR(50) NOT NULL,
    from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    -- Bin tracking (migration 001)
    from_bin_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    to_bin_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_date DATE,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'in_transit', 'received', 'cancelled'
    notes TEXT,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, transfer_number)
);

-- =====================================================
-- 26. STOCK TRANSFER ITEMS (base + migration 001)
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_requested DECIMAL(15, 4) NOT NULL,
    quantity_received DECIMAL(15, 4) DEFAULT 0,
    -- Bin tracking (migration 001)
    from_bin_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    to_bin_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 27. TAX RATES
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5, 2) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- =====================================================
-- 28. AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    changes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 29. NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
    reference_type VARCHAR(100),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 30. USER WAREHOUSE ASSIGNMENTS (migration 025)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, warehouse_id)
);

-- =====================================================
-- 31. JOB ORDERS & BOM (migration 031, 041)
-- =====================================================

CREATE TABLE IF NOT EXISTS job_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    jo_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    customer_id UUID REFERENCES customers(id),
    sales_order_id UUID REFERENCES sales_orders(id),
    approved_by_user_id UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    warehouse_id UUID REFERENCES warehouses(id),
    notes TEXT,
    production_lead TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, jo_number)
);

CREATE TABLE IF NOT EXISTS job_order_bom (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_required DECIMAL(15, 2) NOT NULL,
    quantity_issued DECIMAL(15, 2) NOT NULL DEFAULT 0,
    quantity_returned DECIMAL(15, 2) NOT NULL DEFAULT 0,
    quantity_scrapped DECIMAL(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bill of materials change requests (migration 041)
CREATE TABLE IF NOT EXISTS job_order_bom_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    job_order_bom_id UUID REFERENCES job_order_bom(id) ON DELETE CASCADE,
    -- MRF-style document number, e.g. JO-MRF-yymmdd-0001
    request_number VARCHAR(50),
    product_id UUID NOT NULL REFERENCES products(id),
    current_quantity DECIMAL(15, 2),
    requested_quantity DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
        CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    requested_by_user_id UUID REFERENCES users(id),
    approved_by_user_id UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 32. MATERIAL ISSUE SLIPS - MIS (migration 031)
-- =====================================================

CREATE TABLE IF NOT EXISTS material_issue_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mis_number VARCHAR(50) NOT NULL,
    job_order_id UUID NOT NULL REFERENCES job_orders(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'acknowledged')),
    issued_by_user_id UUID REFERENCES users(id),
    received_by_user_id UUID REFERENCES users(id),
    issued_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    warehouse_id UUID REFERENCES warehouses(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, mis_number)
);

CREATE TABLE IF NOT EXISTS material_issue_slip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_issue_slip_id UUID NOT NULL REFERENCES material_issue_slips(id) ON DELETE CASCADE,
    job_order_bom_id UUID REFERENCES job_order_bom(id),
    product_id UUID REFERENCES products(id),
    quantity_issued DECIMAL(15, 2) NOT NULL,
    bin_location_id UUID REFERENCES bin_locations(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 33. MATERIAL RETURN SLIPS - MRS (migration 031)
-- =====================================================

CREATE TABLE IF NOT EXISTS material_return_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mrs_number VARCHAR(50) NOT NULL,
    job_order_id UUID NOT NULL REFERENCES job_orders(id),
    material_issue_slip_id UUID REFERENCES material_issue_slips(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'returned', 'restocked')),
    returned_by_user_id UUID REFERENCES users(id),
    received_by_user_id UUID REFERENCES users(id),
    returned_at TIMESTAMP WITH TIME ZONE,
    restocked_at TIMESTAMP WITH TIME ZONE,
    warehouse_id UUID REFERENCES warehouses(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, mrs_number)
);

CREATE TABLE IF NOT EXISTS material_return_slip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_return_slip_id UUID NOT NULL REFERENCES material_return_slips(id) ON DELETE CASCADE,
    job_order_bom_id UUID REFERENCES job_order_bom(id),
    product_id UUID REFERENCES products(id),
    quantity_returned DECIMAL(15, 2) NOT NULL,
    condition VARCHAR(20) NOT NULL DEFAULT 'good'
        CHECK (condition IN ('good', 'damaged', 'scrap')),
    bin_location_id UUID REFERENCES bin_locations(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 34. MATERIAL REQUESTS - MRF (migration 031, 039, 040)
-- =====================================================

CREATE TABLE IF NOT EXISTS material_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mrf_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        -- 'cancelled' added in migration 039
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
    urgency_level VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (urgency_level IN ('low', 'normal', 'high', 'critical')),
    requestor_user_id UUID REFERENCES users(id),
    approved_by_user_id UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    notes TEXT,
    job_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL, -- Origin job order (migration 040)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, mrf_number)
);

CREATE TABLE IF NOT EXISTS material_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_requested DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Link purchase orders back to their originating material request (migration 040)
DO $$ BEGIN
    ALTER TABLE purchase_orders
        ADD CONSTRAINT purchase_orders_mrf_id_fkey FOREIGN KEY (mrf_id) REFERENCES material_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_plan_type ON companies(plan_type);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_tin_number ON companies(tin_number);
CREATE INDEX IF NOT EXISTS idx_companies_business_type ON companies(business_type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_admin ON users(company_id, is_company_admin) WHERE is_company_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_force_password_change ON users(company_id, force_password_change) WHERE force_password_change = true;

-- Product Categories
CREATE INDEX IF NOT EXISTS idx_product_categories_company_id ON product_categories(company_id);

-- Unit of Measurements
CREATE INDEX IF NOT EXISTS idx_unit_of_measurements_company ON unit_of_measurements(company_id);

-- Warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_status ON warehouses(status);

-- Bin Locations
CREATE INDEX IF NOT EXISTS idx_bin_locations_company_warehouse ON bin_locations(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bin_locations_warehouse_status ON bin_locations(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_bin_locations_zone_aisle ON bin_locations(zone, aisle);
CREATE INDEX IF NOT EXISTS idx_bin_locations_available ON bin_locations(available_quantity) WHERE status = 'available';
-- Unique: structured bins (zone/aisle/shelf/bin_number all present)
CREATE UNIQUE INDEX IF NOT EXISTS bin_locations_structured_unique
    ON bin_locations(company_id, warehouse_id, zone, aisle, shelf, bin_number)
    WHERE zone IS NOT NULL AND aisle IS NOT NULL AND shelf IS NOT NULL AND bin_number IS NOT NULL AND deleted_at IS NULL;
-- Unique: custom-name bins
CREATE UNIQUE INDEX IF NOT EXISTS bin_locations_name_unique
    ON bin_locations(company_id, warehouse_id, location_name)
    WHERE location_name IS NOT NULL AND deleted_at IS NULL;

-- Products
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_track_batches ON products(company_id, track_batches);
CREATE INDEX IF NOT EXISTS idx_products_allocation_method ON products(allocation_method);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_id ON products(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_bin_location_id ON products(bin_location_id);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_bin ON products(company_id, warehouse_id, bin_location_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(company_id, product_type);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(company_id, brand);
CREATE INDEX IF NOT EXISTS idx_products_shelf_life ON products(shelf_life_days) WHERE shelf_life_days IS NOT NULL;

-- Product Batches
CREATE INDEX IF NOT EXISTS idx_product_batches_company_id ON product_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiration_date ON product_batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_available ON product_batches(quantity_available);

-- Product Property Tables
CREATE INDEX IF NOT EXISTS idx_product_types_company ON product_types(company_id);
CREATE INDEX IF NOT EXISTS idx_warranty_types_company ON warranty_types(company_id);
CREATE INDEX IF NOT EXISTS idx_shelf_life_categories_company ON shelf_life_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_brands_company ON brands(company_id);
CREATE INDEX IF NOT EXISTS idx_handling_instructions_company ON handling_instructions(company_id);

-- Stock Levels
CREATE INDEX IF NOT EXISTS idx_stock_levels_company_id ON stock_levels(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_id ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_bin_location ON stock_levels(bin_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_rejected ON stock_levels(company_id, quantity_rejected DESC);

-- Bin Stock
CREATE INDEX IF NOT EXISTS idx_bin_stock_product ON bin_stock(product_id, quantity) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS idx_bin_stock_bin ON bin_stock(bin_location_id);
CREATE INDEX IF NOT EXISTS idx_bin_stock_company ON bin_stock(company_id);

-- Stock Transactions
CREATE INDEX IF NOT EXISTS idx_stock_transactions_company_id ON stock_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_order_reference ON invoices(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_warehouse_id ON invoices(warehouse_id);

-- Invoice Items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse_id ON purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_mrf_id ON purchase_orders(mrf_id);

-- Purchase Order Items
CREATE INDEX IF NOT EXISTS idx_po_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product_id ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_po_items_warehouse ON purchase_order_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_items_bin_location ON purchase_order_items(bin_location_id);

-- Sales Orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_company_id ON sales_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_warehouse_id ON sales_orders(warehouse_id);

-- Sales Order Items
CREATE INDEX IF NOT EXISTS idx_sales_order_items_so_id ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_warehouse ON sales_order_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_so_items_bin ON sales_order_items(bin_location_id);
CREATE INDEX IF NOT EXISTS idx_so_items_picked ON sales_order_items(quantity_picked, picked_date);

-- GRN
CREATE INDEX IF NOT EXISTS idx_grn_company_id ON grn(company_id);
CREATE INDEX IF NOT EXISTS idx_grn_purchase_order_id ON grn(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier_id ON grn(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON grn(status);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_purchase_order_item_id ON grn_items(purchase_order_item_id);

-- Stock Transfers
CREATE INDEX IF NOT EXISTS idx_stock_transfers_company_id ON stock_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_transfer_number ON stock_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_warehouse ON stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_warehouse ON stock_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_transfer_date ON stock_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_bin ON stock_transfers(from_bin_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_bin ON stock_transfers(to_bin_id);

-- Stock Transfer Items
CREATE INDEX IF NOT EXISTS idx_st_items_stock_transfer_id ON stock_transfer_items(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_st_items_product_id ON stock_transfer_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_from_bin ON stock_transfer_items(from_bin_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_to_bin ON stock_transfer_items(to_bin_id);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- User Warehouse Assignments
CREATE INDEX IF NOT EXISTS idx_user_warehouses_user_id ON user_warehouses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warehouses_warehouse_id ON user_warehouses(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_user_warehouses_company_id ON user_warehouses(company_id);

-- Job Orders & BOM
CREATE INDEX IF NOT EXISTS idx_job_orders_company ON job_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders(status);
CREATE INDEX IF NOT EXISTS idx_job_order_bom_jo ON job_order_bom(job_order_id);
CREATE INDEX IF NOT EXISTS idx_jo_bom_requests_jo ON job_order_bom_requests(job_order_id);
CREATE INDEX IF NOT EXISTS idx_jo_bom_requests_status ON job_order_bom_requests(status);

-- Material Issue Slips (MIS)
CREATE INDEX IF NOT EXISTS idx_mis_company ON material_issue_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_mis_job_order ON material_issue_slips(job_order_id);
CREATE INDEX IF NOT EXISTS idx_mis_items_mis ON material_issue_slip_items(material_issue_slip_id);

-- Material Return Slips (MRS)
CREATE INDEX IF NOT EXISTS idx_mrs_company ON material_return_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_mrs_job_order ON material_return_slips(job_order_id);
CREATE INDEX IF NOT EXISTS idx_mrs_items_mrs ON material_return_slip_items(material_return_slip_id);

-- Material Requests (MRF)
CREATE INDEX IF NOT EXISTS idx_material_requests_company ON material_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_job_order ON material_requests(job_order_id);
CREATE INDEX IF NOT EXISTS idx_material_request_items_mrf ON material_request_items(material_request_id);

-- =====================================================
-- INITIAL DATA
-- =====================================================

INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', '["all"]'::jsonb),
('manager', 'Can manage inventory, invoices, and users', '["inventory:read", "inventory:write", "invoices:read", "invoices:write", "users:read"]'::jsonb),
('sales', 'Can create invoices and view inventory', '["inventory:read", "invoices:read", "invoices:write"]'::jsonb),
('accountant', 'Can manage payments and view invoices', '["invoices:read", "payments:read", "payments:write", "reports:read"]'::jsonb),
('viewer', 'Read-only access', '["inventory:read", "invoices:read"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW invoice_summary AS
SELECT
    i.id,
    i.company_id,
    i.invoice_number,
    c.name AS customer_name,
    i.issue_date,
    i.due_date,
    i.status,
    i.subtotal,
    i.tax_amount,
    i.discount_amount,
    i.shipping_cost,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    COUNT(ii.id) AS item_count,
    u.first_name || ' ' || u.last_name AS issued_by
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
LEFT JOIN users u ON i.issued_by_id = u.id
WHERE i.deleted_at IS NULL
GROUP BY i.id, c.id, u.id;

CREATE OR REPLACE VIEW low_stock_products AS
SELECT
    p.id,
    p.company_id,
    p.sku,
    p.name,
    sl.quantity_on_hand,
    p.reorder_level,
    p.reorder_quantity,
    pc.name AS category_name
FROM products p
LEFT JOIN stock_levels sl ON p.id = sl.product_id
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.deleted_at IS NULL
    AND sl.quantity_on_hand <= p.reorder_level;

CREATE OR REPLACE VIEW outstanding_invoices AS
SELECT
    i.id,
    i.company_id,
    i.invoice_number,
    c.name AS customer_name,
    i.issue_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    CASE
        WHEN i.due_date < CURRENT_DATE AND i.status != 'paid' THEN 'overdue'
        WHEN i.due_date >= CURRENT_DATE AND i.status != 'paid' THEN 'due'
        ELSE i.status
    END AS payment_status,
    (CURRENT_DATE - i.due_date) AS days_overdue
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id
WHERE i.deleted_at IS NULL
    AND i.amount_due > 0
    AND i.status != 'cancelled'
ORDER BY i.due_date ASC;

-- Warehouse capacity overview (migration 001)
CREATE OR REPLACE VIEW warehouse_capacity_overview AS
SELECT
    bl.company_id,
    bl.warehouse_id,
    w.name AS warehouse_name,
    COUNT(*) AS total_bins,
    SUM(bl.capacity) AS total_capacity,
    SUM(bl.current_quantity) AS total_quantity,
    SUM(bl.allocated_quantity) AS total_allocated,
    ROUND(100.0 * SUM(bl.current_quantity) / NULLIF(SUM(bl.capacity), 0), 2) AS utilization_percent,
    COUNT(*) FILTER (WHERE bl.status = 'available') AS available_bins,
    COUNT(*) FILTER (WHERE bl.status = 'maintenance') AS maintenance_bins
FROM bin_locations bl
JOIN warehouses w ON bl.warehouse_id = w.id
WHERE bl.deleted_at IS NULL
GROUP BY bl.company_id, bl.warehouse_id, w.name;

-- Warehouse inventory summary (migration 020)
CREATE OR REPLACE VIEW warehouse_inventory_summary AS
SELECT
    bl.warehouse_id,
    bl.company_id,
    COUNT(*) AS total_bins,
    SUM(bl.current_quantity) AS total_current_quantity,
    SUM(bl.allocated_quantity) AS total_allocated,
    SUM(bl.available_quantity) AS total_available,
    SUM(CASE WHEN bl.status = 'available' THEN 1 ELSE 0 END) AS available_bins,
    SUM(CASE WHEN bl.status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_bins
FROM bin_locations bl
GROUP BY bl.warehouse_id, bl.company_id;

-- Product inventory summary (migration 020)
CREATE OR REPLACE VIEW product_inventory_summary AS
SELECT
    bs.company_id,
    bs.product_id,
    SUM(bs.quantity) AS total_quantity,
    SUM(bs.allocated_quantity) AS total_allocated,
    SUM(bs.available_quantity) AS total_available,
    COUNT(*) AS total_bins
FROM bin_stock bs
GROUP BY bs.company_id, bs.product_id;

-- Available bins (migration 020)
CREATE OR REPLACE VIEW available_bins AS
SELECT
    bl.id,
    bl.company_id,
    bl.warehouse_id,
    bl.zone,
    bl.aisle,
    bl.shelf,
    bl.bin_number,
    bl.capacity,
    bl.current_quantity,
    bl.allocated_quantity,
    bl.available_quantity
FROM bin_locations bl
WHERE bl.status = 'available' AND bl.available_quantity > 0;

-- Product bin distribution (migration 020)
CREATE OR REPLACE VIEW product_bin_distribution AS
SELECT
    bs.product_id,
    bs.company_id,
    COUNT(DISTINCT bs.bin_location_id) AS total_bins,
    SUM(bs.quantity) AS total_quantity,
    SUM(bs.allocated_quantity) AS total_allocated,
    SUM(bs.available_quantity) AS total_available,
    MIN(bs.last_count_date) AS earliest_count,
    MAX(bs.last_count_date) AS latest_count
FROM bin_stock bs
GROUP BY bs.product_id, bs.company_id;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Get total inventory value for a company
CREATE OR REPLACE FUNCTION get_inventory_value(p_company_id UUID)
RETURNS DECIMAL AS $$
SELECT COALESCE(SUM(sl.quantity_on_hand * p.cost_price), 0)
FROM stock_levels sl
JOIN products p ON sl.product_id = p.id
WHERE sl.company_id = p_company_id;
$$ LANGUAGE SQL STABLE;

-- Auto-update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL;
    v_tax_total DECIMAL;
BEGIN
    SELECT
        SUM(quantity * unit_price * (1 - discount_percent / 100)),
        SUM(quantity * unit_price * (1 - discount_percent / 100) * tax_rate / 100)
    INTO v_subtotal, v_tax_total
    FROM invoice_items
    WHERE invoice_id = NEW.invoice_id;

    UPDATE invoices
    SET
        subtotal = COALESCE(v_subtotal, 0),
        tax_amount = COALESCE(v_tax_total, 0),
        total_amount = COALESCE(v_subtotal, 0) + COALESCE(v_tax_total, 0) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_items_update_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_invoice_totals();

-- Create a stock transaction and update stock level
CREATE OR REPLACE FUNCTION create_stock_transaction(
    p_company_id UUID,
    p_product_id UUID,
    p_transaction_type VARCHAR,
    p_quantity INT,
    p_reference_type VARCHAR,
    p_reference_id UUID,
    p_notes TEXT,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_stock_level_id UUID;
BEGIN
    INSERT INTO stock_transactions (
        company_id, product_id, transaction_type,
        quantity, reference_type, reference_id,
        notes, created_by
    ) VALUES (
        p_company_id, p_product_id, p_transaction_type,
        p_quantity, p_reference_type, p_reference_id,
        p_notes, p_user_id
    ) RETURNING id INTO v_transaction_id;

    SELECT id INTO v_stock_level_id
    FROM stock_levels
    WHERE company_id = p_company_id AND product_id = p_product_id;

    IF v_stock_level_id IS NOT NULL THEN
        IF p_transaction_type = 'in' THEN
            UPDATE stock_levels
            SET quantity_on_hand = quantity_on_hand + p_quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_stock_level_id;
        ELSIF p_transaction_type = 'out' THEN
            UPDATE stock_levels
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - p_quantity),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_stock_level_id;
        ELSIF p_transaction_type = 'adjustment' THEN
            UPDATE stock_levels
            SET quantity_on_hand = p_quantity,
                last_stock_count = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_stock_level_id;
        END IF;
    END IF;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update bin_locations.updated_at (migration 001)
CREATE OR REPLACE FUNCTION update_bin_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bin_locations_timestamp
BEFORE UPDATE ON bin_locations
FOR EACH ROW EXECUTE FUNCTION update_bin_locations_timestamp();

-- Auto-update bin_stock.updated_at (migration 001)
CREATE OR REPLACE FUNCTION update_bin_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bin_stock_timestamp
BEFORE UPDATE ON bin_stock
FOR EACH ROW EXECUTE FUNCTION update_bin_stock_timestamp();

-- Audit log for bin_locations changes (migration 001)
CREATE OR REPLACE FUNCTION log_bin_locations_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (company_id, entity_type, entity_id, action, changes, created_at)
        VALUES (NEW.company_id, 'bin_locations', NEW.id, 'CREATE',
                jsonb_build_object('zone', NEW.zone, 'aisle', NEW.aisle, 'shelf', NEW.shelf, 'bin_number', NEW.bin_number),
                CURRENT_TIMESTAMP);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (company_id, entity_type, entity_id, action, changes, created_at)
        VALUES (NEW.company_id, 'bin_locations', NEW.id, 'UPDATE',
                jsonb_build_object(
                    'old_quantity', OLD.current_quantity,
                    'new_quantity', NEW.current_quantity,
                    'old_status', OLD.status,
                    'new_status', NEW.status
                ),
                CURRENT_TIMESTAMP);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (company_id, entity_type, entity_id, action, changes, created_at)
        VALUES (OLD.company_id, 'bin_locations', OLD.id, 'DELETE',
                jsonb_build_object('zone', OLD.zone, 'bin_number', OLD.bin_number),
                CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_bin_locations
AFTER INSERT OR UPDATE OR DELETE ON bin_locations
FOR EACH ROW EXECUTE FUNCTION log_bin_locations_changes();

-- Auto-update purchase_order_items.updated_at (migration 004)
CREATE OR REPLACE FUNCTION update_purchase_order_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_items_timestamp
BEFORE UPDATE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_purchase_order_items_timestamp();

-- Auto-update sales_order_items.updated_at (migration 005)
CREATE OR REPLACE FUNCTION update_sales_order_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_so_items_timestamp
BEFORE UPDATE ON sales_order_items
FOR EACH ROW EXECUTE FUNCTION update_sales_order_items_timestamp();

-- =====================================================
-- END OF SCHEMA
-- =====================================================


-- =====================================================
-- ATOMIC STOCK ADJUSTMENT FUNCTION
-- Replaces all read-then-write stock updates.
-- Eliminates race conditions for concurrent sessions.
-- =====================================================
CREATE OR REPLACE FUNCTION adjust_stock_level(
  p_company_id      UUID,
  p_product_id      UUID,
  p_warehouse_id    UUID,
  p_on_hand_delta   INTEGER DEFAULT 0,
  p_alloc_delta     INTEGER DEFAULT 0,
  p_rejected_delta  INTEGER DEFAULT 0,
  p_scrapped_delta  INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE stock_levels
  SET
    quantity_on_hand   = GREATEST(0, quantity_on_hand   + p_on_hand_delta),
    quantity_allocated = GREATEST(0, quantity_allocated + p_alloc_delta),
    quantity_rejected  = GREATEST(0, quantity_rejected  + p_rejected_delta),
    quantity_scrapped  = GREATEST(0, quantity_scrapped  + p_scrapped_delta),
    updated_at         = NOW()
  WHERE company_id  = p_company_id
    AND product_id  = p_product_id
    AND (
      (p_warehouse_id IS NULL AND warehouse_id IS NULL)
      OR warehouse_id = p_warehouse_id
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    BEGIN
      INSERT INTO stock_levels (
        company_id, product_id, warehouse_id,
        quantity_on_hand, quantity_allocated, quantity_rejected, quantity_scrapped
      ) VALUES (
        p_company_id, p_product_id, p_warehouse_id,
        GREATEST(0, p_on_hand_delta),
        GREATEST(0, p_alloc_delta),
        GREATEST(0, p_rejected_delta),
        GREATEST(0, p_scrapped_delta)
      );
    EXCEPTION WHEN unique_violation THEN
      -- Concurrent INSERT won the race — retry the UPDATE
      UPDATE stock_levels
      SET
        quantity_on_hand   = GREATEST(0, quantity_on_hand   + p_on_hand_delta),
        quantity_allocated = GREATEST(0, quantity_allocated + p_alloc_delta),
        quantity_rejected  = GREATEST(0, quantity_rejected  + p_rejected_delta),
        quantity_scrapped  = GREATEST(0, quantity_scrapped  + p_scrapped_delta),
        updated_at         = NOW()
      WHERE company_id  = p_company_id
        AND product_id  = p_product_id
        AND (
          (p_warehouse_id IS NULL AND warehouse_id IS NULL)
          OR warehouse_id = p_warehouse_id
        );
    END;
  END IF;
END;
$$;
