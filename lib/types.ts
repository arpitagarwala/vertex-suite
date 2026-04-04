// ============================================================
// Aura Inventory - TypeScript Type Definitions
// ============================================================

export type SupplyType = 'intrastate' | 'interstate'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'credit'
export type InvoiceType = 'sale' | 'purchase' | 'credit_note'
export type LocationType = 'warehouse' | 'cf_agent' | 'retail' | 'transit'
export type MovementType = 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return'
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  business_name: string
  owner_name: string
  gstin: string | null
  pan: string | null
  address: string
  city: string
  state_name: string
  state_code: string
  pincode: string
  phone: string
  email: string
  bank_name?: string
  bank_account?: string
  bank_ifsc?: string
  bank_branch?: string
  enable_cnf?: boolean
  logo_url: string | null
  currency: string
  financial_year_start: number
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  user_id: string
  name: string
  type: LocationType
  address: string
  contact_name: string
  contact_phone: string
  is_default: boolean
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  category_id: string | null
  name: string
  sku: string | null
  hsn_code: string | null
  description: string
  unit: string
  cost_price: number
  sale_price: number
  gst_rate: number
  is_service: boolean
  low_stock_alert: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Joins
  category?: Category
  stock?: StockSummary[]
}

export interface StockSummary {
  product_id: string
  location_id: string
  user_id: string
  product_name: string
  sku: string | null
  unit: string
  low_stock_alert: number
  location_name: string
  location_type: LocationType
  current_stock: number
}

export interface StockLedger {
  id: string
  user_id: string
  product_id: string
  location_id: string
  quantity: number
  movement_type: MovementType
  reference_id: string | null
  reference_type: string | null
  notes: string
  created_at: string
}

export interface Customer {
  id: string
  user_id: string
  name: string
  phone: string
  email: string
  gstin: string | null
  address: string
  city: string
  state_name: string
  state_code: string
  customer_type: 'b2b' | 'b2c' | 'vendor'
  total_purchases: number
  last_purchase_at: string | null
  created_at: string
}

export interface InvoiceItem {
  id?: string
  invoice_id?: string
  product_id: string | null
  product_name: string
  hsn_code: string
  quantity: number
  unit: string
  unit_price: number
  discount_pct: number
  taxable_amount: number
  gst_rate: number
  cgst_rate: number
  sgst_rate: number
  igst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

export interface Invoice {
  id: string
  user_id: string
  invoice_number: string
  invoice_type: InvoiceType
  customer_id: string | null
  customer_name: string
  customer_gstin: string
  customer_state_code: string
  supply_type: SupplyType
  invoice_date: string
  due_date: string | null
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_gst: number
  grand_total: number
  amount_paid: number
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  notes: string
  location_id: string | null
  status: 'active' | 'cancelled'
  cash_discount?: number
  cash_discount_note?: string
  edit_count?: number
  last_edited_at?: string
  created_at: string
  // Joins
  customer?: Customer
  items?: InvoiceItem[]
}

export interface StockTransfer {
  id: string
  user_id: string
  transfer_number: string
  from_location_id: string | null
  to_location_id: string | null
  transfer_date: string
  status: TransferStatus
  notes: string
  created_at: string
  // Joins
  from_location?: Location
  to_location?: Location
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id?: string
  transfer_id?: string
  product_id: string
  quantity: number
  product?: Product
}

export interface Expense {
  id: string
  user_id: string
  category: string
  description: string
  amount: number
  expense_date: string
  payment_method: PaymentMethod
  receipt_url: string | null
  created_at: string
}

// Dashboard / Analytics types
export interface DashboardStats {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalGSTLiability: number
  totalProducts: number
  lowStockProducts: number
  totalCustomers: number
  totalInvoices: number
  pendingPayments: number
}

export interface RevenuePoint {
  date: string
  revenue: number
  expenses: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  total_sold: number
  total_revenue: number
}
