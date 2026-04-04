'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDIAN_STATES } from '@/lib/gst'
import { Icons } from '@/components/Icons'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [enableCnf, setEnableCnf] = useState(false)
  const [form, setForm] = useState({
    business_name: '', owner_name: '', gstin: '', pan: '',
    phone: '', email: '', address: '', city: '', state_code: '27', pincode: '',
    bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: ''
  })
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prof }, { data: locs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true)
    ])
    if (prof) {
      setForm({
        business_name: prof.business_name || '', owner_name: prof.owner_name || '',
        gstin: prof.gstin || '', pan: prof.pan || '',
        phone: prof.phone || '', email: prof.email || '',
        address: prof.address || '', city: prof.city || '',
        state_code: prof.state_code || '27', pincode: prof.pincode || '',
        bank_name: prof.bank_name || '', bank_account: prof.bank_account || '',
        bank_ifsc: prof.bank_ifsc || '', bank_branch: prof.bank_branch || ''
      })
      setEnableCnf(prof.enable_cnf ?? false)
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
      ...form, state_name: selectedState?.name || '', enable_cnf: enableCnf
    }).eq('id', user.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  async function addLocation() {
    const locName = prompt('Enter Location Name (e.g. Main Warehouse, Mumbai C&F)')
    if (!locName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('locations').insert({ user_id: user.id, name: locName, type: 'warehouse' })
    load()
  }

  async function deleteLocation(id: string) {
    if (!confirm('Remove this location?')) return
    await supabase.from('locations').update({ is_active: false }).eq('id', id)
    load()
  }

  const setF = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Business profile, locations, and preferences</p>
        </div>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
          <Icons.Check size={16} /> Settings saved successfully!
        </div>
      )}

      <form onSubmit={saveProfile}>
        <div style={{ display:'grid', gap:'var(--space-5)' }}>
          {/* Business Profile */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-5)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.Globe size={16} /> Business Profile
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Business / Company Name <span style={{ color:'var(--brand-danger)' }}>*</span></label>
                <input className="form-input" required value={form.business_name} onChange={e=>setF('business_name',e.target.value)} placeholder="e.g. Sharma Traders Pvt Ltd" />
              </div>
              <div className="form-group">
                <label className="form-label">Owner Name</label>
                <input className="form-input" value={form.owner_name} onChange={e=>setF('owner_name',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Business Phone</label>
                <input className="form-input" type="tel" value={form.phone} onChange={e=>setF('phone',e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN <span style={{ color:'var(--brand-danger)' }}>*</span></label>
                <input className="form-input" value={form.gstin} onChange={e=>setF('gstin',e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">PAN</label>
                <input className="form-input" value={form.pan} onChange={e=>setF('pan',e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
              </div>
              <div className="form-group">
                <label className="form-label">Home State (for GST)</label>
                <select className="form-select" value={form.state_code} onChange={e=>setF('state_code',e.target.value)}>
                  {INDIAN_STATES.map(s=><option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e=>setF('city',e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Full Address</label>
                <textarea className="form-textarea" rows={2} value={form.address} onChange={e=>setF('address',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={e=>setF('pincode',e.target.value)} maxLength={6} />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.FileText size={16} /> Bank Details (shown on invoices)
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" value={form.bank_name} onChange={e=>setF('bank_name',e.target.value)} placeholder="State Bank of India" /></div>
              <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" value={form.bank_account} onChange={e=>setF('bank_account',e.target.value)} /></div>
              <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" value={form.bank_ifsc} onChange={e=>setF('bank_ifsc',e.target.value.toUpperCase())} placeholder="SBIN0001234" /></div>
              <div className="form-group"><label className="form-label">Branch</label><input className="form-input" value={form.bank_branch} onChange={e=>setF('bank_branch',e.target.value)} /></div>
            </div>
          </div>

          {/* C&F Toggle */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.Truck size={16} /> Operations Mode
            </h3>
            <div className="toggle-wrap" style={{ justifyContent:'space-between', padding:'var(--space-4)', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'0.95rem' }}>C&F / Multi-Location Mode</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:2 }}>Enable to manage stock across multiple warehouses and C&F agents. Disable if you operate from a single location.</div>
              </div>
              <div className={`toggle ${enableCnf ? 'on' : ''}`} onClick={() => setEnableCnf(v=>!v)}>
                <div className="toggle-thumb" />
              </div>
            </div>
          </div>

          {/* Locations Panel */}
          {enableCnf && (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-4)' }}>
                <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:8 }}>
                  <Icons.Globe size={16} /> Locations & Warehouses
                </h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addLocation} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Icons.Plus size={14} /> Add Location
                </button>
              </div>
              {loading ? <div className="skeleton" style={{ height:100 }} /> : locations.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No locations yet. Add a warehouse or C&F location to track stock.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
                  {locations.map(l => (
                    <div key={l.id} style={{ padding:'var(--space-3)', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{l.name}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{l.type}</div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)' }} onClick={() => deleteLocation(l.id)}>
                        <Icons.Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving || loading} style={{ display:'flex', alignItems:'center', gap:8, width:'fit-content' }}>
            <Icons.Check size={16} />{saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
