import { createClient } from './supabase/client'

/**
 * Re-scans all unpaid invoices for a contact and allocates 
 * the total accumulated payments on a FIFO basis.
 * This is effectively a "Reconcile Account" operation.
 */
export async function reconcileFIFO(customerId: string, type: 'customer' | 'supplier') {
  const supabase = createClient()
  
  // 1. Get total payments recorded for this customer/type
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('customer_id', customerId)
    .eq('payment_type', type === 'customer' ? 'received' : 'sent')

  const totalPool = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  // 2. Clear all amount_paid on active invoices for this contact/type to start fresh
  await supabase
    .from('invoices')
    .update({ amount_paid: 0, payment_status: 'unpaid' })
    .eq('customer_id', customerId)
    .eq('invoice_type', type === 'customer' ? 'sale' : 'purchase')
    .eq('status', 'active')

  // 3. Fetch invoices sorted by date (FIFO)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, grand_total')
    .eq('customer_id', customerId)
    .eq('invoice_type', type === 'customer' ? 'sale' : 'purchase')
    .eq('status', 'active')
    .order('invoice_date', { ascending: true })

  if (!invoices || invoices.length === 0) return

  // 4. Allocate the pool
  let remaining = totalPool
  const updates = []

  for (const inv of invoices) {
    if (remaining <= 0) break

    const total = Number(inv.grand_total)
    const allocate = Math.min(remaining, total)
    const newStatus = allocate >= total ? 'paid' : 'partial'

    updates.push(
      supabase.from('invoices').update({
        amount_paid: allocate,
        payment_status: newStatus
      }).eq('id', inv.id)
    )

    remaining -= allocate
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }
}
