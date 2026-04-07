'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INDIAN_STATES } from '@/lib/gst'
import { Icons } from '@/components/Icons'

type Mode = 'customer' | 'supplier'

export default function AddSupplierPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', gstin: '', state_code: '',
    address: '', city: '', state: '', pincode: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('customers').insert({
      user_id: user.id, customer_type: 'vendor', ...form
    })
    if (error) { alert(error.message); setLoading(false); return }
    router.refresh()
    router.push('/suppliers')
  }

  const f = (field: string, label: string, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} placeholder={placeholder} value={(form as any)[field]}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
    </div>
  )

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Add Supplier</h1>
          <p className="page-subtitle">Register a new vendor for purchase tracking</p>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="card" style={{ maxWidth: 680 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
            <div className="form-group" style={{ gridColumn:'span 2' }}>
              <label className="form-label">Supplier / Company Name <span style={{ color:'var(--brand-danger)' }}>*</span></label>
              <input className="form-input" required placeholder="e.g. Ramesh Traders Pvt Ltd" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            {f('phone','Phone Number','tel','+91 98765 43210')}
            {f('email','Email Address','email','billing@vendor.com')}
            {f('gstin','GSTIN','text','22AAAAA0000A1Z5')}
            <div className="form-group">
              <label className="form-label">State</label>
              <select className="form-select" value={form.state_code} onChange={e => {
                const s = INDIAN_STATES.find(s => s.code === e.target.value)
                setForm(p => ({ ...p, state_code: e.target.value, state: s?.name || '' }))
              }}>
                <option value="">— Select State —</option>
                {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            {f('city','City','text','Mumbai')}
            <div className="form-group" style={{ gridColumn:'span 2' }}>
              <label className="form-label">Address</label>
              <textarea className="form-textarea" style={{ minHeight:70 }} placeholder="Full address..." value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            {f('pincode','Pincode','text','400001')}
          </div>
          <div style={{ display:'flex', gap:'var(--space-3)', marginTop:'var(--space-6)' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Check size={16} />{loading ? 'Saving...' : 'Save Supplier'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  )
}
