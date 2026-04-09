'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INDIAN_STATES } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import type { InvoiceSettings } from '@/lib/types'
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────
function mergeSettings(saved: Partial<InvoiceSettings> | null | undefined): InvoiceSettings {
  return {
    branding: { ...DEFAULT_INVOICE_SETTINGS.branding, ...(saved?.branding || {}) },
    layout:   { ...DEFAULT_INVOICE_SETTINGS.layout,   ...(saved?.layout || {}) },
    printing: { ...DEFAULT_INVOICE_SETTINGS.printing,  ...(saved?.printing || {}) },
  }
}

// Compress image to JPEG, max 100KB
async function compressImage(file: File, maxW = 400, maxH = 200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxW) { h = h * (maxW / w); w = maxW }
        if (h > maxH) { w = w * (maxH / h); h = maxH }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ── Toggle Component ─────────────────────────────────────────
function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-wrap" style={{ justifyContent:'space-between', padding:'var(--space-3)', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)' }}>
      <div>
        <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{label}</div>
        {description && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:2 }}>{description}</div>}
      </div>
      <div className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [enableCnf, setEnableCnf] = useState(false)
  const [debtorAgingEnabled, setDebtorAgingEnabled] = useState(false)
  const [debtorAgingDays, setDebtorAgingDays] = useState(30)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const signInputRef = useRef<HTMLInputElement>(null)
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
      setDebtorAgingEnabled(prof.debtor_aging_enabled ?? false)
      setDebtorAgingDays(prof.debtor_aging_days ?? 30)
      setInvSettings(mergeSettings(prof.invoice_settings))
      setLogoUrl(prof.logo_url || null)
      setSignatureUrl(prof.signature_url || null)
    }
    setLocations(locs || [])
    setLoading(false)
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const compressed = await compressImage(file, 400, 200, 0.7)
      const path = `${user.id}/logo.jpg`
      await supabase.storage.from('logos').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData.publicUrl + '?t=' + Date.now()
      setLogoUrl(url)
      await supabase.from('profiles').update({ logo_url: url }).eq('id', user.id)
    } catch (e) {
      console.error('Logo upload failed:', e)
      alert('Logo upload failed. Make sure the "logos" storage bucket exists in your Supabase project.')
    }
    setUploadingLogo(false)
  }

  async function handleSignatureUpload(file: File) {
    setUploadingSignature(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const compressed = await compressImage(file, 300, 100, 0.7)
      const path = `${user.id}/signature.jpg`
      await supabase.storage.from('logos').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData.publicUrl + '?t=' + Date.now()
      setSignatureUrl(url)
      await supabase.from('profiles').update({ signature_url: url }).eq('id', user.id)
    } catch (e) {
      console.error('Signature upload failed:', e)
      alert('Signature upload failed.')
    }
    setUploadingSignature(false)
  }

  async function removeLogo() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.storage.from('logos').remove([`${user.id}/logo.jpg`])
    await supabase.from('profiles').update({ logo_url: null }).eq('id', user.id)
    setLogoUrl(null)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const selectedState = INDIAN_STATES.find(s => s.code === form.state_code)
    await supabase.from('profiles').update({
      ...form,
      state_name: selectedState?.name || '',
      enable_cnf: enableCnf,
      debtor_aging_enabled: debtorAgingEnabled,
      debtor_aging_days: debtorAgingDays,
      invoice_settings: invSettings,
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
  const setB = (key: keyof InvoiceSettings['branding'], val: any) => setInvSettings(s => ({ ...s, branding: { ...s.branding, [key]: val } }))
  const setL = (key: keyof InvoiceSettings['layout'], val: boolean) => setInvSettings(s => ({ ...s, layout: { ...s.layout, [key]: val } }))
  const setP = (key: keyof InvoiceSettings['printing'], val: any) => setInvSettings(s => ({ ...s, printing: { ...s.printing, [key]: val } }))

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Business profile, invoice customization, and preferences</p>
        </div>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
          <Icons.Check size={16} /> Settings saved successfully!
        </div>
      )}

      <form onSubmit={saveProfile}>
        <div style={{ display:'grid', gap:'var(--space-5)' }}>
          {/* ═══ Business Profile ═══ */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-5)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.Globe size={16} /> Business Profile
            </h3>

            {/* Logo Upload */}
            <div style={{ marginBottom:'var(--space-5)', padding:'var(--space-4)', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)' }}>
              <div style={{ fontSize:'0.85rem', fontWeight:600, marginBottom:'var(--space-3)' }}>Company Logo</div>
              <div style={{ display:'flex', alignItems:'center', gap:'var(--space-4)' }}>
                {logoUrl ? (
                  <div style={{ position:'relative' }}>
                    <img src={logoUrl} alt="Company Logo" style={{ maxHeight:50, maxWidth:120, objectFit:'contain', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-color)' }} />
                    <button type="button" onClick={removeLogo} style={{ position:'absolute', top:-6, right:-6, background:'var(--brand-danger)', color:'#fff', border:'none', borderRadius:'50%', width:18, height:18, fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    style={{ width:120, height:50, border:'2px dashed var(--border-color)', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.75rem', textAlign:'center' }}
                  >
                    {uploadingLogo ? 'Uploading...' : 'Click to upload'}
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  PNG/JPG, max 400×200px. Auto-compressed for performance.
                </div>
              </div>
            </div>

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

          {/* ═══ Bank Details ═══ */}
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

          {/* ═══ Advanced Invoice Customization (Collapsible) ═══ */}
          <div className="card" style={{ borderColor: showAdvanced ? 'rgba(99,102,241,0.3)' : undefined }}>
            <div
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' }}
            >
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--brand-primary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:8, margin:0 }}>
                <Icons.Settings size={16} /> Advanced Invoice Customization
              </h3>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{showAdvanced ? 'Collapse' : 'Expand to configure'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s', color:'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {showAdvanced && (
              <div className="animate-fade" style={{ marginTop:'var(--space-5)', display:'grid', gap:'var(--space-5)' }}>

                {/* ── 1. Branding & Identity ── */}
                <div>
                  <h4 style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }}>
                    🎨 Branding & Identity
                  </h4>
                  <div style={{ display:'grid', gap:'var(--space-3)' }}>
                    <Toggle label="Show Company Logo" description="Display your uploaded logo at the top of each invoice" checked={invSettings.branding.showLogo} onChange={v => setB('showLogo', v)} />
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-3)' }}>
                      <div className="form-group" style={{ margin:0 }}>
                        <label className="form-label" style={{ fontSize:'0.78rem' }}>Invoice Title</label>
                        <input className="form-input" value={invSettings.branding.title} onChange={e => setB('title', e.target.value)} placeholder="TAX INVOICE" />
                      </div>
                      <div className="form-group" style={{ margin:0 }}>
                        <label className="form-label" style={{ fontSize:'0.78rem' }}>Subtitle (optional)</label>
                        <input className="form-input" value={invSettings.branding.subtitle} onChange={e => setB('subtitle', e.target.value)} placeholder="e.g. Original for Recipient" />
                      </div>
                    </div>
                    <Toggle label="Show Authorised Signatory" description="Include signatory block at the bottom of the invoice" checked={invSettings.branding.showSignature} onChange={v => setB('showSignature', v)} />
                    
                    {invSettings.branding.showSignature && (
                      <Toggle label="Use Digital Signature Image" description="Apply your uploaded signature image to the signatory block" checked={invSettings.branding.showDigitalSignature} onChange={v => setB('showDigitalSignature', v)} />
                    )}

                    {invSettings.branding.showSignature && invSettings.branding.showDigitalSignature && (
                      <div style={{ padding:'var(--space-3)', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)' }}>
                        <div style={{ fontSize:'0.8rem', fontWeight:600, marginBottom:'var(--space-2)' }}>Signature / Stamp Image</div>
                        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
                          {signatureUrl ? (
                            <div style={{ position:'relative' }}>
                              <img src={signatureUrl} alt="Signature" style={{ maxHeight:35, maxWidth:100, objectFit:'contain', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-color)' }} />
                              <button type="button" onClick={async () => {
                                const { data: { user } } = await supabase.auth.getUser()
                                if (!user) return
                                await supabase.storage.from('logos').remove([`${user.id}/signature.jpg`])
                                await supabase.from('profiles').update({ signature_url: null }).eq('id', user.id)
                                setSignatureUrl(null)
                              }} style={{ position:'absolute', top:-5, right:-5, background:'var(--brand-danger)', color:'#fff', border:'none', borderRadius:'50%', width:16, height:16, fontSize:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                            </div>
                          ) : (
                            <div onClick={() => signInputRef.current?.click()} style={{ width:100, height:35, border:'2px dashed var(--border-color)', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.7rem' }}>
                              {uploadingSignature ? '...' : 'Upload'}
                            </div>
                          )}
                          <input ref={signInputRef} type="file" accept="image/png,image/jpeg" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} />
                          <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Auto-compressed to stamp size</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 2. Layout & Fields ── */}
                <div>
                  <h4 style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }}>
                    📋 Layout & Field Configuration
                  </h4>
                  <div style={{ display:'grid', gap:'var(--space-2)' }}>
                    <Toggle label="Show GSTIN/UIN" description="Display seller and buyer GSTIN on the invoice" checked={invSettings.layout.showGSTIN} onChange={v => setL('showGSTIN', v)} />
                    <Toggle label="Show Buyer Address" description="Display consignee (buyer) details section" checked={invSettings.layout.showBuyerAddress} onChange={v => setL('showBuyerAddress', v)} />
                    <Toggle label="Show Shipping Address" description="Add a 'Ship To' column next to buyer details (if different from billing)" checked={invSettings.layout.showShippingAddress} onChange={v => setL('showShippingAddress', v)} />
                    <Toggle label="Show HSN/SAC Codes" description="Display HSN/SAC code column in the items table" checked={invSettings.layout.showHSN} onChange={v => setL('showHSN', v)} />
                    <Toggle label="Show PAN/CIN" description="Display PAN number on the invoice header" checked={invSettings.layout.showPAN} onChange={v => setL('showPAN', v)} />
                    <Toggle label="Show Bank Details" description="Company bank account information in the footer" checked={invSettings.layout.showBankDetails} onChange={v => setL('showBankDetails', v)} />
                    <Toggle label="Show Amount in Words" description="Display 'Indian Rupees...' text below the total" checked={invSettings.layout.showAmountInWords} onChange={v => setL('showAmountInWords', v)} />
                    <Toggle label="Show Tax Breakdown Table" description="CGST/SGST or IGST breakdown table in the footer" checked={invSettings.layout.showTaxBreakdown} onChange={v => setL('showTaxBreakdown', v)} />
                    <Toggle label="Show Buyer's Order No." description="Add an order reference field when creating invoices" checked={invSettings.layout.showBuyerOrderNo} onChange={v => setL('showBuyerOrderNo', v)} />
                    <Toggle label="Show Transport Details" description="Transport mode and vehicle number fields" checked={invSettings.layout.showTransportDetails} onChange={v => setL('showTransportDetails', v)} />
                  </div>
                </div>

                {/* ── 3. Printing & Paper ── */}
                <div>
                  <h4 style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }}>
                    🖨️ Printing & Paper
                  </h4>
                  <div style={{ display:'grid', gap:'var(--space-3)' }}>
                    <div className="form-group" style={{ margin:0 }}>
                      <label className="form-label" style={{ fontSize:'0.78rem' }}>Paper Size</label>
                      <select className="form-select" value={invSettings.printing.paperSize} onChange={e => setP('paperSize', e.target.value)}>
                        <option value="a4">A4 (210 × 297 mm) — Standard</option>
                        <option value="a5">A5 (148 × 210 mm) — Compact / Save Paper</option>
                      </select>
                    </div>
                    <Toggle label="Compact Mode" description="Reduce spacing to fit more items per page" checked={invSettings.printing.compactMode} onChange={v => setP('compactMode', v)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Debtor Management ═══ */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.AlertTriangle size={16} /> Debtor Management
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
              <Toggle label="Debtor Aging Notifications" description="Track and notify when customers have unpaid invoices older than set days." checked={debtorAgingEnabled} onChange={setDebtorAgingEnabled} />
              {debtorAgingEnabled && (
                <div className="form-group animate-fade" style={{ padding:'0 var(--space-2)' }}>
                  <label className="form-label">Aging Threshold (Days)</label>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <input type="number" className="form-input" style={{ maxWidth: 120 }} value={debtorAgingDays} onChange={e => setDebtorAgingDays(parseInt(e.target.value) || 0)} min={1} />
                    <span style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>Days after invoice date to trigger alert</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Operations Mode ═══ */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)', display:'flex', alignItems:'center', gap:8 }}>
              <Icons.Truck size={16} /> Operations Mode
            </h3>
            <Toggle label="C&F / Multi-Location Mode" description="Enable to manage stock across multiple warehouses and C&F agents. Disable if you operate from a single location." checked={enableCnf} onChange={setEnableCnf} />
          </div>

          {/* ═══ Locations Panel ═══ */}
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
