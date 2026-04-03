'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDIAN_STATES } from '@/lib/gst'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business_name: '', owner_name: '', gstin: '', pan: '',
    phone: '', email: '', address: '', city: '', state_code: '27', pincode: ''
  })
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: locs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('locations').select('*').eq('user_id', user.id)
    ])

    if (prof) {
      setForm({
         business_name: prof.business_name || '',
         owner_name: prof.owner_name || '',
         gstin: prof.gstin || '', pan: prof.pan || '',
         phone: prof.phone || '', email: prof.email || '',
         address: prof.address || '', city: prof.city || '',
         state_code: prof.state_code || '27', pincode: prof.pincode || ''
      })
    }
    setLocations(locs || [])
    setLoading(false)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const selectedState = INDIAN_STATES.find(s => s.code === form.state_code)
    
    await supabase.from('profiles').update({
       business_name: form.business_name, owner_name: form.owner_name,
       gstin: form.gstin, pan: form.pan,
       phone: form.phone, email: form.email,
       address: form.address, city: form.city,
       state_code: form.state_code, state_name: selectedState?.name || '',
       pincode: form.pincode
    }).eq('id', user.id)
    
    alert('Settings saved successfully!')
    setSaving(false)
  }

  async function addLocation() {
    const locName = prompt('Enter Location Name (e.g. Main Warehouse)')
    if (!locName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    await supabase.from('locations').insert({
       user_id: user.id, name: locName, type: 'warehouse'
    })
    load()
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
         <div className="page-header-left">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your business profile and locations</p>
         </div>
      </div>

      <div className="grid grid-2 gap-6">
        <div className="card">
           <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1.05rem' }}>🏢 Business Profile</h3>
           <form onSubmit={saveProfile} style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div className="form-group">
                 <label className="form-label">Business Name</label>
                 <input className="form-input" required value={form.business_name} onChange={e => setForm(f => ({...f, business_name: e.target.value}))} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                 <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input className="form-input" value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value.toUpperCase()}))} placeholder="15-digit GSTIN" />
                 </div>
                 <div className="form-group">
                    <label className="form-label">Home State (for GST calculation)</label>
                    <select className="form-select" value={form.state_code} onChange={e => setForm(f => ({...f, state_code: e.target.value}))}>
                       {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                    </select>
                 </div>
              </div>

              <div className="form-group">
                 <label className="form-label">Address</label>
                 <textarea className="form-textarea" rows={2} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                 {saving ? 'Saving...' : 'Save Profile'}
              </button>
           </form>
        </div>

        <div className="card">
           <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📍 Locations & C&F Agents</span>
              <button className="btn btn-secondary btn-sm" onClick={addLocation}>+ Add Location</button>
           </h3>
           
           {loading ? <div className="skeleton" style={{ height: 100 }} /> : locations.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
                 <p>No locations added yet.</p>
              </div>
           ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                 {locations.map(l => (
                    <div key={l.id} style={{ padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                          <div style={{ fontWeight: 600 }}>{l.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type: <span style={{ textTransform: 'capitalize' }}>{l.type}</span></div>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </div>
    </div>
  )
}
