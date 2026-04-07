'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons } from '@/components/Icons'

export default function EditExpensePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  
  const [form, setForm] = useState({
    category: 'salary',
    description: '',
    amount: '',
    expense_date: '',
    payment_method: 'cash'
  })

  useEffect(() => {
    async function load() {
      if (!id) return
      const { data } = await supabase.from('expenses').select('*').eq('id', id).single()
      if (data) {
        setForm({
          category: data.category || 'general',
          description: data.description || '',
          amount: data.amount ? data.amount.toString() : '',
          expense_date: data.expense_date ? data.expense_date.split('T')[0] : '',
          payment_method: data.payment_method || 'cash'
        })
      }
      setInitialLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase.from('expenses').update({
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      expense_date: form.expense_date,
      payment_method: form.payment_method
    }).eq('id', id)

    if (error) { alert(error.message); setLoading(false); return }
    // Redirect back to the grouped category page they came from
    router.refresh()
    router.push(`/expenses/category/${encodeURIComponent(form.category.toLowerCase())}`)
  }

  if (initialLoading) {
    return (
      <div className="animate-fade">
        <div style={{ maxWidth: 500, height: 400 }} className="card skeleton" />
      </div>
    )
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Edit Expense</h1>
          <p className="page-subtitle">Update an operational cost record</p>
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
             <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icons.Check size={16} />{loading ? 'Saving...' : 'Update Expense'}
             </button>
             <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  )
}
