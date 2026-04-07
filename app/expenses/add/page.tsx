'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddExpensePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState({
    category: 'salary',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      payment_method: form.payment_method
    })

    if (error) { alert(error.message); setLoading(false); return }
    router.refresh()
    router.push('/expenses')
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Log Expense</h1>
          <p className="page-subtitle">Record a business expense for P&L tracking</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 500 }}>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Expense Date</label>
            <input className="form-input" type="date" required value={form.expense_date} onChange={e => setForm(f => ({...f, expense_date: e.target.value}))} />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
              <option value="salary">Salary / Wages</option>
              <option value="rent">Rent & Facilities</option>
              <option value="utilities">Utilities (Electricity, Water)</option>
              <option value="marketing">Marketing & Ads</option>
              <option value="logistics">Shipping & Transport</option>
              <option value="software">Software & IT</option>
              <option value="general">General / Misc</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" min="0.01" step="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Paid To</label>
            <input className="form-input" required placeholder="e.g. Office electricity bill" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="credit">Credit Card</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
             <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Expense'}
             </button>
             <button type="button" className="btn btn-secondary" onClick={() => router.push('/expenses')}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  )
}
