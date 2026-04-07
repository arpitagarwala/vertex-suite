'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GST_RATES, GST_RATE_LABELS } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import type { Category, Location } from '@/lib/types'

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'pair', 'metre', 'sq.ft', 'roll']

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    name: '', sku: '', hsn_code: '', description: '',
    category_id: '', unit: 'pcs', cost_price: '', sale_price: '',
    gst_rate: 18, low_stock_alert: 10, is_service: false
  })

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: prod }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('categories').select('*').eq('user_id', user.id),
    ])
    if (!prod) { router.push('/inventory'); return }
    setForm({
      name: prod.name || '', sku: prod.sku || '', hsn_code: prod.hsn_code || '',
      description: prod.description || '', category_id: prod.category_id || '',
      unit: prod.unit || 'pcs', cost_price: prod.cost_price?.toString() || '',
      sale_price: prod.sale_price?.toString() || '', gst_rate: prod.gst_rate || 18,
      low_stock_alert: prod.low_stock_alert || 10, is_service: prod.is_service || false
    })
    setCategories(cats || [])
    setPageLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('products').update({
      name: form.name, sku: form.sku || null, hsn_code: form.hsn_code || null,
      description: form.description, category_id: form.category_id || null,
      unit: form.unit, cost_price: parseFloat(form.cost_price) || 0,
      sale_price: parseFloat(form.sale_price), gst_rate: form.gst_rate,
      low_stock_alert: form.low_stock_alert, is_service: form.is_service,
    }).eq('id', id)
    if (error) { alert(error.message); setLoading(false); return }
    router.refresh()
    router.push(`/inventory/${id}`)
  }

  if (pageLoading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Edit Product</h1>
          <p className="page-subtitle">Update product details and pricing</p>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gap:'var(--space-5)', maxWidth:720 }}>
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Basic Information</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Product Name <span style={{ color:'var(--brand-danger)' }}>*</span></label>
                <input className="form-input" required value={form.name} onChange={e=>set('name',e.target.value)} />
              </div>
              <div className="form-group"><label className="form-label">SKU</label><input className="form-input" value={form.sku} onChange={e=>set('sku',e.target.value)} /></div>
              <div className="form-group"><label className="form-label">HSN Code</label><input className="form-input" value={form.hsn_code} onChange={e=>set('hsn_code',e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
                  <option value="">— No Category —</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e=>set('unit',e.target.value)}>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Pricing & GST</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Cost Price (₹)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.cost_price} onChange={e=>set('cost_price',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sale Price (₹) <span style={{ color:'var(--brand-danger)' }}>*</span></label>
                <input className="form-input" type="number" min="0" step="0.01" required value={form.sale_price} onChange={e=>set('sale_price',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">GST Rate</label>
                <select className="form-select" value={form.gst_rate} onChange={e=>set('gst_rate',parseFloat(e.target.value))}>
                  {GST_RATES.map(r=><option key={r} value={r}>{GST_RATE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Low Stock Alert</label>
                <input className="form-input" type="number" min="0" value={form.low_stock_alert} onChange={e=>set('low_stock_alert',parseInt(e.target.value)||0)} />
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'var(--space-3)' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Check size={16} />{loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  )
}
