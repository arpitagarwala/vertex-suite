-- ============================================================
-- Migration: Advanced Invoice Customization
-- Adds JSONB settings column, new invoice fields, signature URL
-- ============================================================

-- Invoice customization preferences (JSONB for flexibility)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT NULL;

-- New optional invoice fields (shown when enabled in settings)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_state TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_pincode TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS buyer_order_no TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_no TEXT DEFAULT '';
