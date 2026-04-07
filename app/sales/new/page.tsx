'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateItemGST, calculateInvoiceTotals, formatINR } from '@/lib/gst'
import { useDraft } from '@/lib/useDraft'
import { Icons } from '@/components/Icons'
import { SearchableSelect } from '@/components/SearchableSelect'
import type { Product, Customer, Location, InvoiceItem } from '@/lib/types'

interface LineItem extends InvoiceItem { _key: string; priceMode: 'exclusive' | 'inclusive'; enteredPrice: number }

const GST_SLABS = [0, 5, 18, 40]

const defaultItem = (): LineItem => ({
  _key: Math.random().toString(36).slice(2),
  product_id: null, product_name: '', hsn_code: '', quantity: 1, unit: 'pcs',
  unit_price: 0, discount_pct: 0, taxable_amount: 0, gst_rate: 18,
  cgst_rate: 0, sgst_rate: 0, igst_rate: 0,
  cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0,
  priceMode: 'exclusive', enteredPrice: 0
})

const defaultForm = {
  customer_id: '', customer_name: '', customer_gstin: '',
  customer_state_code: '', customer_phone: '', customer_address: '', supply_type: 'intrastate',
  invoice_date: new Date().toISOString().split('T')[0],
  payment_method: 'cash', payment_status: 'paid', amount_paid: '', notes: '', location_id: '',
}

export default function NewSalePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [userProfile, setUserProfile] = useState<{ state_code: string }>({ state_code: '27' })
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({})
  const [items, setItems, clearItemsDraft] = useDraft<LineItem[]>('sale_items', [defaultItem()])
  const [form, setForm, clearFormDraft] = useDraft('sale_form', defaultForm)
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('vs_draft_sale_form')
    if (stored) setHasDraft(true)
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
      if (locs?.[0] && !form.location_id) setForm(f => ({ ...f, location_id: locs[0].id }))
    }
    load()
  }, [])

  useEffect(() => {
    if (!form.location_id) { setStockLevels({}); return }
    async function loadStock() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('stock_summary').select('product_id, current_stock')
        .eq('user_id', user.id).eq('location_id', form.location_id)
      const stockMap: Record<string, number> = {}
      data?.forEach(s => { stockMap[s.product_id] = s.current_stock || 0 })
      setStockLevels(stockMap)
    }
    loadStock()
  }, [form.location_id])

  function calcItem(item: LineItem, supplyType: string): LineItem {
    const isInterState = supplyType === 'interstate'
    let unitPrice = item.priceMode === 'inclusive'
      ? (item.enteredPrice || 0) / (1 + item.gst_rate / 100)
      : (item.enteredPrice || 0)
    const gst = calculateItemGST({ quantity: item.quantity || 0, unitPrice, discountPct: item.discount_pct || 0, gstRate: item.gst_rate as 0|5|18|40, isInterState })
    return { ...item, unit_price: unitPrice, taxable_amount: gst.taxableAmount, cgst_rate: gst.cgstRate, sgst_rate: gst.sgstRate, igst_rate: gst.igstRate, cgst_amount: gst.cgstAmount, sgst_amount: gst.sgstAmount, igst_amount: gst.igstAmount, total_amount: gst.grandTotal }
  }

  function updateItem(key: string, field: string, value: any) {
    setItems(prev => prev.map(item => { if (item._key !== key) return item; return calcItem({ ...item, [field]: value }, form.supply_type) }))
  }

  function selectProduct(key: string, productId: string) {
    const p = products.find(p => p.id === productId)
    if (!p) return
    setItems(prev => prev.map(item => { if (item._key !== key) return item; return calcItem({ ...item, product_id: p.id, product_name: p.name, hsn_code: p.hsn_code || '', unit: p.unit, enteredPrice: p.sale_price, gst_rate: p.gst_rate }, form.supply_type) }))
  }

  function selectCustomer(id: string) {
    const c = customers.find(c => c.id === id)
    if (!c) { setForm(f => ({ ...f, customer_id: '', customer_name: '', customer_gstin: '', customer_state_code: '', customer_phone: '', customer_address: '', supply_type: 'intrastate' })); return }
    const isInter = c.state_code && c.state_code !== userProfile.state_code ? 'interstate' : 'intrastate'
    setForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, customer_gstin: c.gstin || '', customer_state_code: c.state_code, customer_phone: c.phone || '', customer_address: c.address || '', supply_type: isInter }))
    setItems(prev => prev.map(item => calcItem(item, isInter)))
  }

  function handlePhoneChange(phone: string) {
    setForm(f => ({ ...f, customer_phone: phone }))
    if (phone.length >= 10 && !form.customer_id) {
      const match = customers.find(c => c.phone?.includes(phone) || phone.includes(c.phone))
      if (match) selectCustomer(match.id)
    }
  }

  const totals = calculateInvoiceTotals(items.map(i => ({ taxableAmount: i.taxable_amount, cgstAmount: i.cgst_amount, sgstAmount: i.sgst_amount, igstAmount: i.igst_amount, totalAmount: i.total_amount })))
  const isInterState = form.supply_type === 'interstate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some(i => !i.product_name)) { alert('All line items must have a product name'); return }
    for (const item of items) {
      if (item.product_id && form.location_id) {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && !prod.is_service) {
          const available = stockLevels[item.product_id] || 0
          if (item.quantity > available) { alert(`Not enough stock for ${item.product_name}. Available: ${available}`); return }
        }
      }
    }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let finalCustomerId = form.customer_id
    if (!finalCustomerId && form.customer_phone) {
      const { data: newCust, error: custErr } = await supabase.from('customers').insert({
        user_id: user.id,
        name: form.customer_name || 'Walk-in Customer',
        phone: form.customer_phone,
        address: form.customer_address,
        gstin: form.customer_gstin || null,
        state_code: form.customer_state_code,
        customer_type: form.customer_gstin ? 'b2b' : 'b2c'
      }).select().single()
      if (!custErr && newCust) finalCustomerId = newCust.id
    }

    const { data: numData } = await supabase.rpc('next_invoice_number', { p_user_id: user.id })
    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: user.id, invoice_number: numData || `INV-${Date.now()}`, invoice_type: 'sale',
      customer_id: finalCustomerId || null, customer_name: form.customer_name || 'Walk-in Customer',
      customer_gstin: form.customer_gstin, customer_state_code: form.customer_state_code,
      supply_type: form.supply_type, invoice_date: form.invoice_date,
      subtotal: totals.subtotal, taxable_amount: totals.taxableAmount,
      cgst_amount: totals.cgstAmount, sgst_amount: totals.sgstAmount, igst_amount: totals.igstAmount,
      total_gst: totals.totalGST, grand_total: totals.grandTotal,
      amount_paid: parseFloat(form.amount_paid) || (form.payment_status === 'paid' ? totals.grandTotal : 0),
      payment_status: form.payment_status, payment_method: form.payment_method,
      notes: form.notes, location_id: form.location_id || null,
      status: 'active'
    }).select().single()
    if (error) { alert(error.message); setLoading(false); return }
    await supabase.from('invoice_items').insert(items.map(({ _key, priceMode, enteredPrice, ...item }) => ({ ...item, invoice_id: invoice.id })))
    for (const item of items) {
      if (item.product_id && form.location_id) {
        const prod = products.find(p => p.id === item.product_id)
        if (prod && !prod.is_service) {
          await supabase.from('stock_ledger').insert({ user_id: user.id, product_id: item.product_id, location_id: form.location_id, quantity: -item.quantity, movement_type: 'sale', reference_id: invoice.id, reference_type: 'invoice' })
        }
      }
    }
    clearFormDraft(); clearItemsDraft()
    router.push(`/sales/${invoice.id}`)
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Invoice</h1>
          <p className="page-subtitle">Create a GST-compliant sale invoice</p>
        </div>
        {hasDraft && (
          <div className="alert alert-info" style={{ padding:'8px 12px', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Info size={14} /> Draft restored —
            <button onClick={() => { clearFormDraft(); clearItemsDraft(); setForm(defaultForm); setItems([defaultItem()]); setHasDraft(false) }}
              style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', textDecoration:'underline' }}>Clear</button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gap:'var(--space-5)' }}>
          {/* Customer & Details */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Customer & Invoice Details</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Customer</label>
                <select className="form-select" value={form.customer_id} onChange={e => selectCustomer(e.target.value)}>
                  <option value="">Walk-in / Cash Customer</option>
                  {customers.filter(c => c.customer_type !== 'vendor').map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="e.g. 9876543210 (Auto-fetches details if matches)" value={form.customer_phone} onChange={e => handlePhoneChange(e.target.value)} />
              </div>
              {!form.customer_id && (
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" placeholder="Walk-in Customer" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
              )}
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="Billing Address..." value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supply Type</label>
                <select className="form-select" value={form.supply_type} onChange={e => { const st = e.target.value; setForm(f => ({ ...f, supply_type: st })); setItems(prev => prev.map(i => calcItem(i, st))) }}>
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
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Products / Services</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
              {items.map((item) => (
                <div key={item._key} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', border:'1px solid var(--border-subtle)' }}>
                  <div className="sale-item-grid">
                    <div className="form-group" style={{ flex:'2 1 180px' }}>
                      <label className="form-label">Product</label>
                      <SearchableSelect
                        options={products.map(p => ({ id: p.id, name: p.name, sub: `Stock: ${stockLevels[p.id] || 0} ${p.unit}` }))}
                        value={item.product_id || ''}
                        onChange={(val) => selectProduct(item._key, val)}
                        placeholder="— Search Product —"
                      />
                    </div>
                    <div className="form-group" style={{ flex:'0 0 80px', position: 'relative' }}>
                      <label className="form-label">Qty</label>
                      <input className="form-input" type="number" min="0.001" step="0.001" value={item.quantity}
                        onChange={e => updateItem(item._key, 'quantity', parseFloat(e.target.value) || 0)} />
                      {item.product_id && form.location_id && (() => {
                        const available = stockLevels[item.product_id] || 0
                        return <div style={{ position: 'absolute', top: '100%', left: 0, fontSize:'0.72rem', marginTop:2, color: item.quantity > available ? 'var(--brand-danger)' : 'var(--text-muted)' }}>Stock: {available}</div>
                      })()}
                    </div>
                    <div className="form-group" style={{ flex:'0 0 100px' }}>
                      <label className="form-label">GST %</label>
                      <select className="form-select" value={item.gst_rate} onChange={e => updateItem(item._key, 'gst_rate', parseFloat(e.target.value))}>
                        {GST_SLABS.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex:'0 0 100px' }}>
                      <label className="form-label">Price Mode</label>
                      <div style={{ display:'flex', gap:2 }}>
                        {(['exclusive','inclusive'] as const).map(m => (
                          <button key={m} type="button" className={`tab ${item.priceMode===m?'active':''}`} style={{ flex:1, fontSize:'0.72rem', padding:'6px 2px' }} onClick={() => updateItem(item._key,'priceMode',m)}>
                            {m==='exclusive'?'+GST':'Incl.'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex:'1 1 110px' }}>
                      <label className="form-label">{item.priceMode==='inclusive'?'MRP (Incl GST)':'Rate (₹)'}</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={item.enteredPrice || ''}
                        onChange={e => updateItem(item._key, 'enteredPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ flex:'0 0 90px', display:'flex', flexDirection:'column', gap:4 }}>
                      <span className="form-label">Total</span>
                      <div style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--brand-primary-light)', height: 38, display: 'flex', alignItems: 'center', fontSize:'0.9rem' }}>{formatINR(item.total_amount)}</div>
                    </div>
                    {items.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)', alignSelf:'flex-end', marginBottom:4 }}
                        onClick={() => setItems(p => p.filter(i => i._key !== item._key))}>
                        <Icons.Trash size={14} />
                      </button>
                    )}
                  </div>
                  
                  {/* Custom Description Row below the grid */}
                  {item.product_name && (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <input className="form-input" style={{ fontSize: '0.8rem', background: 'transparent', padding: '6px 12px', border: '1px solid var(--border-subtle)' }} placeholder="Custom Description (Prints on Invoice) - Optional" value={item.product_name}
                        onChange={e => updateItem(item._key, 'product_name', e.target.value)} />
                    </div>
                  )}

                  <div style={{ display:'flex', gap:'var(--space-4)', marginTop:'var(--space-2)', fontSize:'0.72rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
                    <span>Taxable: {formatINR(item.taxable_amount)}</span>
                    {isInterState ? <span>IGST ({item.igst_rate}%): {formatINR(item.igst_amount)}</span>
                      : <><span>CGST: {formatINR(item.cgst_amount)}</span><span>SGST: {formatINR(item.sgst_amount)}</span></>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }}
              onClick={() => setItems(p => [...p, defaultItem()])}>
              <Icons.Plus size={14} /> Add Line Item
            </button>
          </div>

          {/* Payment + Totals */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-5)' }}>
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Payment</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {[['cash','Cash'],['upi','UPI'],['bank','Bank Transfer'],['credit','Credit']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                    <option value="paid">Fully Paid</option>
                    <option value="partial">Partial Payment</option>
                    <option value="unpaid">Credit / Unpaid</option>
                  </select>
                </div>
                {form.payment_status === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">Amount Received (₹)</label>
                    <input className="form-input" type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Invoice Summary</h3>
              <div className="gst-breakdown-row"><span>Subtotal</span><span className="font-mono">{formatINR(totals.subtotal)}</span></div>
              {isInterState ? <div className="gst-breakdown-row"><span>IGST</span><span className="font-mono">{formatINR(totals.igstAmount)}</span></div>
                : <><div className="gst-breakdown-row"><span>CGST</span><span className="font-mono">{formatINR(totals.cgstAmount)}</span></div>
                   <div className="gst-breakdown-row"><span>SGST</span><span className="font-mono">{formatINR(totals.sgstAmount)}</span></div></>}
              <div className="gst-breakdown-row"><span>Total GST</span><span className="font-mono" style={{ color:'var(--brand-primary-light)' }}>{formatINR(totals.totalGST)}</span></div>
              <div className="gst-breakdown-row total"><span>Grand Total</span><span className="font-mono" style={{ color:'var(--brand-success)', fontSize:'1.2rem' }}>{formatINR(totals.grandTotal)}</span></div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop:'var(--space-5)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }} disabled={loading}>
                <Icons.Check size={16} />{loading ? 'Saving...' : 'Create Invoice →'}
              </button>
              <button type="button" className="btn btn-secondary btn-full" style={{ marginTop:'var(--space-2)' }} onClick={() => router.push('/sales')}>Cancel</button>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        .sale-item-grid { display: grid; grid-template-columns: minmax(200px, 2fr) 80px 100px 100px 110px 100px 30px; gap: var(--space-3); align-items: flex-end; }
        @media (max-width: 900px) {
          .sale-item-grid { grid-template-columns: 1fr 1fr; }
          .sale-item-grid > *:first-child { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}
