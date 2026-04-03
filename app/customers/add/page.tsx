'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INDIAN_STATES } from '@/lib/gst'

export default function AddCustomerPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    customer_type: 'b2c', gstin: '',
    address: '', city: '', state_code: '27'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const selectedState = INDIAN_STATES.find(s => s.code === form.state_code)
    
    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      customer_type: form.customer_type,
      gstin: form.customer_type === 'b2b' ? form.gstin.trim() : null,
      address: form.address.trim(),
      city: form.city.trim(),
      state_code: form.state_code,
      state_name: selectedState?.name || '',
    })

    if (error) { alert(error.message); setLoading(false); return }
    router.push('/customers')
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Add Customer</h1>
          <p className="page-subtitle">Register a new client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 600 }}>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Customer Name <span className="required">*</span></label>
            <input className="form-input" required placeholder="e.g. Acme Corp or John Doe" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
             <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="10-digit number" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="customer@example.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Customer Type</label>
              <select className="form-select" value={form.customer_type} onChange={e => setForm(f => ({...f, customer_type: e.target.value}))}>
                <option value="b2c">B2C (Consumer - No GSTIN)</option>
                <option value="b2b">B2B (Business - Has GSTIN)</option>
              </select>
            </div>
            {form.customer_type === 'b2b' && (
              <div className="form-group">
                <label className="form-label">GSTIN <span className="required">*</span></label>
                <input className="form-input" required placeholder="15-digit GSTIN" value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value.toUpperCase()}))} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Billing Address</label>
            <textarea className="form-textarea" placeholder="Street address..." value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} rows={2} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
             <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" placeholder="e.g. Mumbai" value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <select className="form-select" value={form.state_code} onChange={e => setForm(f => ({...f, state_code: e.target.value}))}>
                {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/customers')}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
