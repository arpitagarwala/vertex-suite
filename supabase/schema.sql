-- ============================================================
-- AURA INVENTORY - Complete Supabase Schema
-- Indian GST System + C&F Location Tracking
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (Business Details)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  business_name TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  gstin TEXT DEFAULT NULL,
  pan TEXT DEFAULT NULL,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state_name TEXT NOT NULL DEFAULT 'Maharashtra',
  state_code TEXT NOT NULL DEFAULT '27',
  pincode TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT NULL,
  currency TEXT DEFAULT 'INR',
  financial_year_start INT DEFAULT 4, -- April
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOCATIONS (C&F Tracking)
-- ============================================================
CREATE TABLE locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,  -- e.g., "Main Warehouse", "CF Agent - Mumbai", "Retail Counter"
  type TEXT NOT NULL DEFAULT 'warehouse', -- warehouse | cf_agent | retail | transit
  address TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT DEFAULT NULL,
  hsn_code TEXT DEFAULT NULL,       -- HSN/SAC Code for GST
  description TEXT DEFAULT '',
  unit TEXT DEFAULT 'pcs',          -- pcs, kg, ltr, box, etc.
  cost_price DECIMAL(12,2) DEFAULT 0,
  sale_price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 18, -- 0, 5, 12, 18, 28
  is_service BOOLEAN DEFAULT FALSE,
  low_stock_alert INT DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK LEDGER (Count Tracking per Location)
-- ============================================================
CREATE TABLE stock_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,         -- +ve = stock in, -ve = stock out
  movement_type TEXT NOT NULL,              -- purchase | sale | transfer_in | transfer_out | adjustment | return
  reference_id UUID DEFAULT NULL,           -- invoice_id or transfer_id
  reference_type TEXT DEFAULT NULL,         -- invoice | transfer | adjustment
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIEW: Current stock per product per location
CREATE VIEW stock_summary AS
SELECT
  sl.product_id,
  sl.location_id,
  sl.user_id,
  p.name AS product_name,
  p.sku,
  p.unit,
  p.low_stock_alert,
  l.name AS location_name,
  l.type AS location_type,
  SUM(sl.quantity) AS current_stock
FROM stock_ledger sl
JOIN products p ON p.id = sl.product_id
JOIN locations l ON l.id = sl.location_id
GROUP BY sl.product_id, sl.location_id, sl.user_id, p.name, p.sku, p.unit, p.low_stock_alert, l.name, l.type;

-- ============================================================
-- CUSTOMERS (B2B & B2C)
-- ============================================================
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  gstin TEXT DEFAULT NULL,           -- If B2B customer
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state_name TEXT DEFAULT '',
  state_code TEXT DEFAULT '',
  customer_type TEXT DEFAULT 'b2c',  -- b2b | b2c
  total_purchases DECIMAL(14,2) DEFAULT 0,
  last_purchase_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_type TEXT DEFAULT 'sale',          -- sale | purchase | credit_note
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT DEFAULT '',
  customer_gstin TEXT DEFAULT '',
  customer_state_code TEXT DEFAULT '',
  supply_type TEXT DEFAULT 'intrastate',     -- intrastate | interstate
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT NULL,
  subtotal DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  taxable_amount DECIMAL(14,2) DEFAULT 0,
  cgst_amount DECIMAL(14,2) DEFAULT 0,       -- For intrastate
  sgst_amount DECIMAL(14,2) DEFAULT 0,       -- For intrastate
  igst_amount DECIMAL(14,2) DEFAULT 0,       -- For interstate
  total_gst DECIMAL(14,2) DEFAULT 0,
  grand_total DECIMAL(14,2) DEFAULT 0,
  amount_paid DECIMAL(14,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',      -- paid | partial | unpaid
  payment_method TEXT DEFAULT 'cash',        -- cash | upi | bank | credit
  notes TEXT DEFAULT '',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',              -- active | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  hsn_code TEXT DEFAULT '',
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT DEFAULT 'pcs',
  unit_price DECIMAL(12,2) NOT NULL,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  taxable_amount DECIMAL(14,2) NOT NULL,
  gst_rate DECIMAL(5,2) DEFAULT 18,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(14,2) DEFAULT 0,
  sgst_amount DECIMAL(14,2) DEFAULT 0,
  igst_amount DECIMAL(14,2) DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL
);

-- ============================================================
-- STOCK TRANSFERS (C&F Movement)
-- ============================================================
CREATE TABLE stock_transfers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transfer_number TEXT NOT NULL,
  from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  transfer_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',  -- pending | in_transit | completed | cancelled
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(12,3) NOT NULL
);

-- ============================================================
-- EXPENSES (For P&L tracking)
-- ============================================================
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  receipt_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "Users own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- All other tables: user_id must match
CREATE POLICY "Users own locations" ON locations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own stock_ledger" ON stock_ledger FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own customers" ON customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own invoices" ON invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own transfers" ON stock_transfers FOR ALL USING (auth.uid() = user_id);

-- Invoice items via invoice ownership
CREATE POLICY "Users own invoice_items" ON invoice_items FOR ALL
  USING (EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND user_id = auth.uid()));

-- Transfer items via transfer ownership
CREATE POLICY "Users own transfer_items" ON stock_transfer_items FOR ALL
  USING (EXISTS (SELECT 1 FROM stock_transfers WHERE id = transfer_id AND user_id = auth.uid()));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generate Invoice Number
CREATE OR REPLACE FUNCTION next_invoice_number(p_user_id UUID, p_prefix TEXT DEFAULT 'INV')
RETURNS TEXT AS $$
DECLARE
  v_count INT;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYMM');
  SELECT COUNT(*) + 1 INTO v_count FROM invoices WHERE user_id = p_user_id;
  RETURN p_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
