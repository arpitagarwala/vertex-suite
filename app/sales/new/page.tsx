'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateItemGST, calculateInvoiceTotals, formatINR, INDIAN_STATES } from '@/lib/gst'
import type { Product, Customer, Location, InvoiceItem } from '@/lib/types'

interface LineItem extends InvoiceItem {
  _key: string
}

const defaultItem = (): LineItem => ({
  _key: Math.random().toString(36).slice(2),
  product_id: null, product_name: '', hsn_code: '', quantity: 1, unit: 'pcs',
  unit_price: 0, discount_pct: 0, taxable_amount: 0, gst_rate: 18,
  cgst_rate: 0, sgst_rate: 0, igst_rate: 0,
  cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0
})

export default function NewSalePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [items, setItems] = useState<LineItem[]>([defaultItem()])
  const [userProfile, setUserProfile] = useState<{ state_code: string }>({ state_code: '27' })
  const [productSearch, setProductSearch] = useState<Record<string, string>>({})
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    customer_id: '', customer_name: '', customer_gstin: '',
    customer_state_code: '', supply_type: 'intrastate',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash', payment_status: 'paid',
    amount_paid: '', notes: '', location_id: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prods }, { data: custs }, { data: locs }, { data: profile }] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('customers').select('*').eq('user_id', user.id).order('name'),
        supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('profiles').select('state_code').eq('id', user.id).single(),
      ])
      setProducts(prods || [])
      setCustomers(custs || [])
      setLocations(locs || [])
      if (profile) setUserProfile(profile)
      if (locs?.[0]) setForm(f => ({ ...f, location_id: locs[0].id }))
    }
    load()
  }, [])

  useEffect(() => {
    if (!form.location_id) {
      setStockLevels({})
      return
    }
    async function loadStock() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('stock_summary')
        .select('product_id, current_stock')
        .eq('user_id', user.id)
        .eq('location_id', form.location_id)
      
      const stockMap: Record<string, number> = {}
      data?.forEach(s => { stockMap[s.product_id] = s.current_stock || 0 })
      setStockLevels(stockMap)
    }
    loadStock()
  }, [form.location_id])

  // Recalculate line item when fields change
  function recalcItem(item: LineItem, supplyType: string): LineItem {
    const isInterState = supplyType === 'interstate'
    const gst = calculateItemGST({
      quantity: item.quantity || 0,
      unitPrice: item.unit_price || 0,
      discountPct: item.discount_pct || 0,
      gstRate: item.gst_rate as 0|5|12|18|28,
      isInterState,
    })
    return {
      ...item,
      taxable_amount: gst.taxableAmount,
      cgst_rate: gst.cgstRate, sgst_rate: gst.sgstRate, igst_rate: gst.igstRate,
      cgst_amount: gst.cgstAmount, sgst_amount: gst.sgstAmount, igst_amount: gst.igstAmount,
      total_amount: gst.grandTotal,
    }
  }

  function updateItem(key: string, field: string, value: string | number | null) {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item
      const updated = { ...item, [field]: value }
      return recalcItem(updated, form.supply_type)
    }))
  }

  function selectProduct(key: string, productId: string) {
    const p = products.find(p => p.id === productId)
    if (!p) return
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item
      const updated = { ...item, product_id: p.id, product_name: p.name, hsn_code: p.hsn_code || '', unit: p.unit, unit_price: p.sale_price, gst_rate: p.gst_rate }
      return recalcItem(updated, form.supply_type)
    }))
    setProductSearch(s => ({ ...s, [key]: '' }))
  }

  function selectCustomer(id: string) {
    const c = customers.find(c => c.id === id)
    if (!c) { setForm(f => ({ ...f, customer_id: '', customer_name: '', customer_gstin: '', customer_state_code: '', supply_type: 'intrastate' })); return }
    const isInter = c.state_code && c.state_code !== userProfile.state_code ? 'interstate' : 'intrastate'
    setForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, customer_gstin: c.gstin || '', customer_state_code: c.state_code, supply_type: isInter }))
    setItems(prev => prev.map(item => recalcItem(item, isInter)))
  }

  const mappedItemsForTotal = items.map(i => ({
    taxableAmount: i.taxable_amount,
    cgstAmount: i.cgst_amount,
    sgstAmount: i.sgst_amount,
    igstAmount: i.igst_amount,
    totalAmount: i.total_amount
  }))
  const totals = calculateInvoiceTotals(mappedItemsForTotal)
  const isInterState = form.supply_type === 'interstate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some(i => !i.product_name)) { alert('All line items must have a product name'); return }
    
    // Validate stock
    for (const item of items) {
      if (item.product_id && form.location_id) {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && !prod.is_service) {
           const available = stockLevels[item.product_id] || 0
           if (item.quantity > available) {
             alert(`Not enough stock for ${item.product_name}. Available: ${available}`)
             return
           }
        }
      }
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Generate invoice number
    const { data: numData } = await supabase.rpc('next_invoice_number', { p_user_id: user.id })

    const invoicePayload = {
      user_id: user.id,
      invoice_number: numData || `INV-${Date.now()}`,
      invoice_type: 'sale',
      customer_id: form.customer_id || null,
      customer_name: form.customer_name || 'Walk-in Customer',
      customer_gstin: form.customer_gstin,
      customer_state_code: form.customer_state_code,
      supply_type: form.supply_type,
      invoice_date: form.invoice_date,
      subtotal: totals.subtotal,
      discount_amount: 0,
      taxable_amount: totals.taxableAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      igst_amount: totals.igstAmount,
      total_gst: totals.totalGST,
      grand_total: totals.grandTotal,
      amount_paid: parseFloat(form.amount_paid) || (form.payment_status === 'paid' ? totals.grandTotal : 0),
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      notes: form.notes,
      location_id: form.location_id || null,
    }

    const { data: invoice, error } = await supabase.from('invoices').insert(invoicePayload).select().single()
    if (error) { alert(error.message); setLoading(false); return }

    // Insert line items
    const lineItems = items.map(({ _key, ...item }) => ({ ...item, invoice_id: invoice.id }))
    await supabase.from('invoice_items').insert(lineItems)

    // Deduct stock for each item (if not service)
    for (const item of items) {
      if (item.product_id && form.location_id) {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && !prod.is_service) {
          await supabase.from('stock_ledger').insert({
            user_id: user.id, product_id: item.product_id,
            location_id: form.location_id,
            quantity: -item.quantity,
            movement_type: 'sale', reference_id: invoice.id, reference_type: 'invoice',
          })
        }
      }
    }

    router.push(`/sales/${invoice.id}`)
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Invoice</h1>
          <p className="page-subtitle">Create a GST-compliant sale invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gap:'var(--space-5)' }}>

          {/* Customer & Details */}
          <div className="card">
            <h3 style={{ marginBottom:'var(--space-5)', fontSize:'0.95rem' }}>👤 Customer & Invoice Details</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Customer</label>
                <select className="form-select" value={form.customer_id} onChange={e => selectCustomer(e.target.value)}>
                  <option value="">Walk-in / Cash Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.city ? `— ${c.city}` : ''}</option>)}
                </select>
              </div>
              {!form.customer_id && (
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" placeholder="Walk-in Customer" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supply Type</label>
                <select className="form-select" value={form.supply_type} onChange={e => {
                  const st = e.target.value
                  setForm(f => ({ ...f, supply_type: st }))
                  setItems(prev => prev.map(i => recalcItem(i, st)))
                }}>
                  <option value="intrastate">Intrastate (CGST + SGST)</option>
                  <option value="interstate">Interstate (IGST)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location / Counter</label>
                <select className="form-select" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">— No Location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <h3 style={{ marginBottom:'var(--space-4)', fontSize:'0.95rem' }}>📦 Products / Services</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
              {items.map((item, idx) => (
                <div key={item._key} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', border:'1px solid var(--border-subtle)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:'var(--space-3)', alignItems:'end' }}>
                    {/* Product selector */}
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">Product / Service</label>}
                      <select className="form-select" value={item.product_id || ''} onChange={e => selectProduct(item._key, e.target.value)}>
                        <option value="">— Select Product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                      </select>
                      {item.product_name && (
                        <input className="form-input" style={{ marginTop:4, fontSize:'0.8rem' }} placeholder="Product name" value={item.product_name} onChange={e => updateItem(item._key, 'product_name', e.target.value)} />
                      )}
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">Qty</label>}
                      <div>
                        <input className="form-input" type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(item._key, 'quantity', parseFloat(e.target.value) || 0)} />
                        {(() => {
                           if (!item.product_id || !form.location_id) return null
                           const prod = products.find(p => p.id === item.product_id)
                           if (prod?.is_service) return null
                           const available = stockLevels[item.product_id] || 0
                           const invalid = item.quantity > available
                           return (
                             <div style={{ fontSize: '0.75rem', marginTop: 4, color: invalid ? 'var(--brand-danger)' : 'var(--text-muted)' }}>
                               Stock: {available}
                             </div>
                           )
                        })()}
                      </div>
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">Unit Price (₹)</label>}
                      <input className="form-input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(item._key, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">GST%</label>}
                      <select className="form-select" value={item.gst_rate} onChange={e => updateItem(item._key, 'gst_rate', parseFloat(e.target.value))}>
                        {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {idx === 0 && <span className="form-label">Total</span>}
                      <div style={{ fontWeight:700, fontFamily:'var(--font-mono)', fontSize:'0.9rem', color:'var(--text-primary)', padding:'10px 0' }}>
                        {formatINR(item.total_amount)}
                      </div>
                    </div>
                  </div>
                  {/* GST detail row */}
                  <div style={{ display:'flex', gap:'var(--space-4)', marginTop:'var(--space-2)', fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <span>Taxable: {formatINR(item.taxable_amount)}</span>
                    {isInterState
                      ? <span>IGST ({item.igst_rate}%): {formatINR(item.igst_amount)}</span>
                      : <><span>CGST ({item.cgst_rate}%): {formatINR(item.cgst_amount)}</span><span>SGST ({item.sgst_rate}%): {formatINR(item.sgst_amount)}</span></>
                    }
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(prev => prev.filter(i => i._key !== item._key))}
                        style={{ marginLeft:'auto', color:'var(--brand-danger)', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem' }}>
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:'var(--space-3)' }} onClick={() => setItems(p => [...p, defaultItem()])}>
              + Add Line Item
            </button>
          </div>

          {/* Totals & Payment */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-5)' }}>
            {/* Payment */}
            <div className="card">
              <h3 style={{ marginBottom:'var(--space-4)', fontSize:'0.95rem' }}>💳 Payment</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {[['cash','💵 Cash'],['upi','📱 UPI'],['bank','🏦 Bank Transfer'],['credit','📝 Credit']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                    <option value="paid">✅ Fully Paid</option>
                    <option value="partial">⚡ Partial Payment</option>
                    <option value="unpaid">⏳ Credit / Unpaid</option>
                  </select>
                </div>
                {form.payment_status === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">Amount Received (₹)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="card">
              <h3 style={{ marginBottom:'var(--space-4)', fontSize:'0.95rem' }}>🧮 Invoice Summary</h3>
              <div>
                <div className="gst-breakdown-row"><span>Subtotal</span><span className="monospace">{formatINR(totals.subtotal)}</span></div>
                <div className="gst-breakdown-row"><span>Taxable Amount</span><span className="monospace">{formatINR(totals.taxableAmount)}</span></div>
                {isInterState
                  ? <div className="gst-breakdown-row"><span>IGST</span><span className="monospace">{formatINR(totals.igstAmount)}</span></div>
                  : <>
                      <div className="gst-breakdown-row"><span>CGST</span><span className="monospace">{formatINR(totals.cgstAmount)}</span></div>
                      <div className="gst-breakdown-row"><span>SGST</span><span className="monospace">{formatINR(totals.sgstAmount)}</span></div>
                    </>
                }
                <div className="gst-breakdown-row"><span>Total GST</span><span className="monospace" style={{ color:'var(--brand-primary-light)' }}>{formatINR(totals.totalGST)}</span></div>
                <div className="gst-breakdown-row total">
                  <span>Grand Total</span>
                  <span className="monospace" style={{ color:'var(--brand-success)', fontSize:'1.2rem' }}>{formatINR(totals.grandTotal)}</span>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop:'var(--space-5)' }} disabled={loading}>
                {loading ? '⏳ Saving...' : '✅ Create Invoice →'}
              </button>
              <button type="button" className="btn btn-secondary btn-full" style={{ marginTop:'var(--space-2)' }} onClick={() => router.push('/sales')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
