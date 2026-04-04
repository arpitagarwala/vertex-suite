-- Migration: Add fields for edits and cash discount
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS edit_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cash_discount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_discount_note TEXT;

-- Migration: Add cnf toggle and bank details to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS enable_cnf BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT;
