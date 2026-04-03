// ============================================================
// GST Utility Functions - Indian Tax System
// CGST + SGST for intrastate, IGST for interstate
// ============================================================

export type GSTRate = 0 | 5 | 12 | 18 | 28

export interface GSTBreakdown {
  taxableAmount: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalGST: number
  grandTotal: number
}

export interface InvoiceItemGST {
  quantity: number
  unitPrice: number
  discountPct: number
  gstRate: GSTRate
  isInterState: boolean
}

/**
 * Calculate GST for a single line item
 */
export function calculateItemGST(item: InvoiceItemGST): GSTBreakdown {
  const discountedPrice = item.unitPrice * (1 - item.discountPct / 100)
  const taxableAmount = Math.round(discountedPrice * item.quantity * 100) / 100

  let cgstRate = 0, sgstRate = 0, igstRate = 0
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0

  if (item.isInterState) {
    igstRate = item.gstRate
    igstAmount = Math.round(taxableAmount * igstRate / 100 * 100) / 100
  } else {
    cgstRate = item.gstRate / 2
    sgstRate = item.gstRate / 2
    cgstAmount = Math.round(taxableAmount * cgstRate / 100 * 100) / 100
    sgstAmount = Math.round(taxableAmount * sgstRate / 100 * 100) / 100
  }

  const totalGST = cgstAmount + sgstAmount + igstAmount
  return {
    taxableAmount,
    cgstRate, sgstRate, igstRate,
    cgstAmount, sgstAmount, igstAmount,
    totalGST,
    grandTotal: Math.round((taxableAmount + totalGST) * 100) / 100
  }
}

/**
 * Calculate GST totals for an entire invoice
 */
export function calculateInvoiceTotals(
  items: Array<{ taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; totalAmount: number }>,
  discountAmount = 0
) {
  const subtotal = items.reduce((s, i) => s + i.taxableAmount, 0)
  const taxableAmount = subtotal - discountAmount
  const cgstAmount = items.reduce((s, i) => s + i.cgstAmount, 0)
  const sgstAmount = items.reduce((s, i) => s + i.sgstAmount, 0)
  const igstAmount = items.reduce((s, i) => s + i.igstAmount, 0)
  const totalGST = cgstAmount + sgstAmount + igstAmount
  const grandTotal = taxableAmount + totalGST

  return { subtotal, taxableAmount, cgstAmount, sgstAmount, igstAmount, totalGST, grandTotal }
}

/**
 * Format currency in Indian format ₹1,23,456.00
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Convert number to words (for invoice totals)
 */
export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertHundreds(n: number): string {
    if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100)
    if (n >= 20) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[n]
  }

  if (num === 0) return 'Zero'
  let n = Math.floor(num)
  let result = ''
  if (n >= 10000000) { result += convertHundreds(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000) { result += convertHundreds(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000) { result += convertHundreds(Math.floor(n / 1000)) + ' Thousand '; n %= 1000 }
  if (n > 0) result += convertHundreds(n)
  return result.trim() + ' Rupees Only'
}

/**
 * GST rate slabs for India
 */
export const GST_RATES: GSTRate[] = [0, 5, 12, 18, 28]

export const GST_RATE_LABELS: Record<GSTRate, string> = {
  0: 'Exempt (0%)',
  5: '5% GST',
  12: '12% GST',
  18: '18% GST',
  28: '28% GST',
}

/**
 * Indian state codes for GST
 */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
]
