'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Icons } from './Icons'
import { formatINR } from '@/lib/gst'
import type { Customer, Invoice } from '@/lib/types'

interface Props {
  contact: Customer
  type: 'customer' | 'supplier'
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ contact, type, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('bank')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payAmt = parseFloat(amount)
    if (!payAmt || payAmt <= 0) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 1. Record the Payment
      const { data: payRecord, error: payErr } = await supabase.from('payments').insert({
        user_id: user.id,
        customer_id: contact.id,
        amount: payAmt,
        payment_date: date,
        payment_method: method,
        payment_type: type === 'customer' ? 'received' : 'sent',
        reference_no: ref,
        notes: notes
      }).select().single()

      if (payErr) throw payErr

      // 2. FIFO Allocation
      // Fetch unpaid invoices for this contact and type
      // type === 'customer' => sales invoices (receivable)
      // type === 'supplier' => purchase invoices (payable)
      const { data: unpaidInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', contact.id)
        .eq('invoice_type', type === 'customer' ? 'sale' : 'purchase')
        .eq('status', 'active')
        .lt('amount_paid', 'grand_total') // Technically we need to check if amount_paid < grand_total
        // Supabase doesn't support comparing columns directly in filters well without RPC
        // So we filter on the client since it won't be thousands of active invoices per client
        .order('invoice_date', { ascending: true })

      if (unpaidInvoices) {
        let remaining = payAmt
        const updates = []

        for (const inv of unpaidInvoices) {
          const due = Number(inv.grand_total) - Number(inv.amount_paid || 0)
          if (due <= 0) continue

          const allocate = Math.min(remaining, due)
          const newPaid = Number(inv.amount_paid || 0) + allocate
          const newStatus = newPaid >= Number(inv.grand_total) ? 'paid' : 'partial'

          updates.push(
            supabase.from('invoices').update({
              amount_paid: newPaid,
              payment_status: newStatus
            }).eq('id', inv.id)
          )

          remaining -= allocate
          if (remaining <= 0) break
        }

        if (updates.length > 0) {
          await Promise.all(updates)
        }
      }

      onSuccess()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-slide-up" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Record {type === 'customer' ? 'Receipt' : 'Payment'}</h3>
          <button className="btn-close" onClick={onClose}><Icons.X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: 'var(--space-5)' }}>
          <div className="form-group mb-4">
            <label className="form-label">Amount {type === 'customer' ? 'Received' : 'Paid'} (₹)</label>
            <input 
              type="number" 
              className="form-input" 
              autoFocus
              required 
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="form-help">This will be automatically adjusted against the oldest unpaid bills.</p>
          </div>

          <div className="grid grid-2 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Method</label>
              <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="bank">Bank Transfer / NEFT</option>
                <option value="upi">UPI / QR Scan</option>
                <option value="cash">Cash</option>
                <option value="check">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Reference No. (Optional)</label>
            <input className="form-input" placeholder="Txn ID, Check No, etc." value={ref} onChange={e => setRef(e.target.value)} />
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Processing...' : `Save ${type === 'customer' ? 'Receipt' : 'Payment'}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex; alignItems: center; justifyContent: center;
          padding: 20px;
        }
        .modal-content {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 100%;
          box-shadow: var(--shadow-xl);
          overflow: hidden;
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex; alignItems: center; justifyContent: space-between;
        }
        .btn-close {
          background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;
        }
        .btn-close:hover { color: var(--text-main); }
      `}</style>
    </div>
  )
}
