'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Product, Location } from '@/lib/types'

export default function NewTransferPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  
  const [form, setForm] = useState({
    from_location_id: '',
    to_location_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  
  const [items, setItems] = useState<{product_id: string, quantity: number, _key: string}[]>([{
    product_id: '', quantity: 1, _key: '1'
  }])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prods }, { data: locs }] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_service', false),
        supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true)
      ])
      setProducts(prods || [])
      setLocations(locs || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.from_location_id || !form.to_location_id) { alert('Select both source and destination locations'); return }
    if (form.from_location_id === form.to_location_id) { alert('Locations must be different'); return }
    if (items.some(i => !i.product_id || i.quantity <= 0)) { alert('Select valid products and quantities'); return }
    
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const trnNum = `TRN-${Date.now().toString().slice(-6)}`
    
    const { data: transfer, error } = await supabase.from('stock_transfers').insert({
      user_id: user.id,
      transfer_number: trnNum,
      from_location_id: form.from_location_id,
      to_location_id: form.to_location_id,
      transfer_date: form.transfer_date,
      status: 'pending',
      notes: form.notes
    }).select().single()

    if (error) { alert(error.message); setLoading(false); return }

    const transferItems = items.map(i => ({ transfer_id: transfer.id, product_id: i.product_id, quantity: i.quantity }))
    await supabase.from('stock_transfer_items').insert(transferItems)
    
    router.push('/transfers')
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Stock Transfer</h1>
          <p className="page-subtitle">Move stock between locations or C&F agents</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 800 }}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Transfer Date</label>
              <input className="form-input" type="date" value={form.transfer_date} onChange={e => setForm(f => ({...f, transfer_date: e.target.value}))} />
            </div>
            <div />
            
            <div className="form-group">
              <label className="form-label">From Location</label>
              <select className="form-select" required value={form.from_location_id} onChange={e => setForm(f => ({...f, from_location_id: e.target.value}))}>
                <option value="">— Select Source —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">To Location <span style={{ color: 'var(--brand-primary-light)' }}>(C&F / Warehouse)</span></label>
              <select className="form-select" required value={form.to_location_id} onChange={e => setForm(f => ({...f, to_location_id: e.target.value}))}>
                <option value="">— Select Destination —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Items to Transfer</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {items.map((item, idx) => (
                <div key={item._key} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <select className="form-select" required value={item.product_id} onChange={e => setItems(p => p.map(i => i._key === item._key ? {...i, product_id: e.target.value} : i))}>
                     <option value="">— Select Product —</option>
                     {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="form-input" type="number" min="1" placeholder="Qty" required value={item.quantity || ''} onChange={e => setItems(p => p.map(i => i._key === item._key ? {...i, quantity: parseFloat(e.target.value)} : i))} />
                  <button type="button" className="btn btn-ghost" onClick={() => setItems(p => p.filter(i => i._key !== item._key))} disabled={items.length === 1}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => setItems(p => [...p, {product_id: '', quantity: 1, _key: Math.random().toString()}])}>+ Add Item</button>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (e.g. Vehicle Number / Driver Name)</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Queue Transfer'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/transfers')}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
