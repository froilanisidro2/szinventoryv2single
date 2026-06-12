-- Purchase Orders Tables
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  po_number VARCHAR UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  issued_by_id UUID REFERENCES users(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR DEFAULT 'draft', -- draft, sent, confirmed, partially_received, received, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  description VARCHAR,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_price NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Transfers (Location to Location)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  transfer_number VARCHAR UNIQUE NOT NULL,
  from_location VARCHAR NOT NULL,
  to_location VARCHAR NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR DEFAULT 'pending', -- pending, in_transit, received, cancelled
  notes TEXT,
  transferred_by_id UUID REFERENCES users(id),
  received_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_stock_transfers_company_id ON stock_transfers(company_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX idx_stock_transfer_items_transfer_id ON stock_transfer_items(stock_transfer_id);

-- Sales Orders Tables
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  so_number VARCHAR UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  issued_by_id UUID REFERENCES users(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR DEFAULT 'draft', -- draft, sent, confirmed, partially_shipped, shipped, delivered, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'USD',
  payment_terms VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  description VARCHAR NOT NULL,
  quantity_ordered DECIMAL(15, 4) NOT NULL,
  quantity_shipped DECIMAL(15, 4) DEFAULT 0,
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price * (1 - discount_percent / 100) * (1 + tax_rate / 100)) STORED,
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_orders_company_id ON sales_orders(company_id);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_order_items_so_id ON sales_order_items(sales_order_id);
