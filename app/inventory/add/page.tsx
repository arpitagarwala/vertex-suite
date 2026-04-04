'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons } from '@/components/Icons'
import { GST_RATES, GST_RATE_LABELS } from '@/lib/gst'
import type { Category, Location } from '@/lib/types'

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'pair', 'metre', 'sq.ft', 'roll']

export default function AddProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [openingStock, setOpeningStock] = useState(0)
  const [openingLocationId, setOpeningLocationId] = useState('')

  const [form, setForm] = useState({
    name: '', sku: '', hsn_code: '', description: '',
    category_id: '', unit: 'pcs',
    cost_price: '', sale_price: '',
    gst_rate: 18, low_stock_alert: 10, is_service: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: cats }, { data: locs }] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true)
      ])
      setCategories(cats || [])
      setLocations(locs || [])
      if (locs?.[0]) setOpeningLocationId(locs[0].id)
    }
    load()
  }, [])

  function set(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.sale_price || parseFloat(form.sale_price) < 0) e.sale_price = 'Valid sale price required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: product, error } = await supabase.from('products').insert({
      user_id: user.id,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      hsn_code: form.hsn_code.trim() || null,
      description: form.description.trim(),
      category_id: form.category_id || null,
      unit: form.unit,
      cost_price: parseFloat(form.cost_price) || 0,
      sale_price: parseFloat(form.sale_price),
      gst_rate: form.gst_rate,
      low_stock_alert: form.low_stock_alert,
      is_service: form.is_service,
    }).select().single()

    if (error) { alert(error.message); setLoading(false); return }

    // Add opening stock if provided
    if (openingStock > 0 && openingLocationId && product) {
      await supabase.from('stock_ledger').insert({
        user_id: user.id,
        product_id: product.id,
        location_id: openingLocationId,
        quantity: openingStock,
        movement_type: 'adjustment',
        notes: 'Opening stock entry',
      })
    }

    router.push('/inventory')
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Add Product</h1>
          <p className="page-subtitle">Add a new product or service to your inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: 'var(--space-6)', maxWidth: 720 }}>

          {/* Basic Info */}
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-5)', fontSize: '0.95rem' }}>📋 Basic Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Product Name <span style={{ color: 'var(--brand-danger)' }}>*</span></label>
                <input className={`form-input ${errors.name ? 'input-error' : ''}`} placeholder="e.g. Basmati Rice 5kg" value={form.name} onChange={e => set('name', e.target.value)} />
                {errors.name && <span className="error-msg">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">SKU / Item Code</label>
                <input className="form-input" placeholder="e.g. RICE-5KG-001" value={form.sku} onChange={e => set('sku', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">HSN / SAC Code</label>
                <input className="form-input" placeholder="e.g. 1006" value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                  <option value="">— No Category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit of Measurement</label>
                <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Optional product description..." value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_service} onChange={e => set('is_service', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)' }} />
                  <span className="form-label" style={{ margin: 0 }}>This is a service (not a physical product)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Pricing & GST */}
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-5)', fontSize: '0.95rem' }}>💰 Pricing & GST</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Cost Price (₹)</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sale Price (₹) <span style={{ color: 'var(--brand-danger)' }}>*</span></label>
                <input className={`form-input ${errors.sale_price ? 'input-error' : ''}`} type="number" min="0" step="0.01" placeholder="0.00" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} />
                {errors.sale_price && <span className="error-msg">{errors.sale_price}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">GST Rate</label>
                <select className="form-select" value={form.gst_rate} onChange={e => set('gst_rate', parseFloat(e.target.value))}>
                  {GST_RATES.map(r => <option key={r} value={r}>{GST_RATE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            {/* Price preview */}
            {form.sale_price && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Taxable</div>
                  <div style={{ fontWeight: 700 }}>₹{parseFloat(form.sale_price || '0').toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>GST ({form.gst_rate}%)</div>
                  <div style={{ fontWeight: 700, color: 'var(--brand-primary-light)' }}>₹{(parseFloat(form.sale_price || '0') * form.gst_rate / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Total</div>
                  <div style={{ fontWeight: 700, color: 'var(--brand-success)' }}>₹{(parseFloat(form.sale_price || '0') * (1 + form.gst_rate / 100)).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Margin</div>
                  <div style={{ fontWeight: 700, color: form.cost_price && parseFloat(form.sale_price) > parseFloat(form.cost_price) ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                    {form.cost_price ? `${(((parseFloat(form.sale_price) - parseFloat(form.cost_price)) / parseFloat(form.sale_price)) * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stock */}
          {!form.is_service && (
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'var(--space-5)' }}>
                <Icons.Inventory size={20} color="var(--brand-primary-light)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Stock Settings</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Low Stock Alert (units)</label>
                  <input className="form-input" type="number" min="0" value={form.low_stock_alert} onChange={e => set('low_stock_alert', parseInt(e.target.value) || 0)} />
                </div>
                <div />
                {locations.length > 0 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Opening Stock (units)</label>
                      <input className="form-input" type="number" min="0" value={openingStock} onChange={e => setOpeningStock(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <select className="form-select" value={openingLocationId} onChange={e => setOpeningLocationId(e.target.value)}>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {locations.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)', display:'flex', alignItems:'center', gap:8 }}>
                    <Icons.Info size={16} /> Add a location in Settings to track opening stock.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="submit" className="btn btn-primary btn-lg" style={{ display:'flex', alignItems:'center', gap:8 }} disabled={loading}>
              {loading ? <Icons.RefreshCw size={18} className="animate-spin" /> : <Icons.Check size={18} />}
              {loading ? 'Saving...' : 'Save Product'}
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push('/inventory')}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
