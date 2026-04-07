'use client'
import { useState, useEffect } from 'react'
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
  payment_status: 'paid', amount_paid: '', notes: '',
  location_id: '', bill_number: ''
}

export default function NewPurchasePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Customer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [userProfile, setUserProfile] = useState<{ state_code: string; enable_cnf?: boolean }>({ state_code: '27', enable_cnf: true })
  const [items, setItems, clearItemsDraft] = useDraft<LineItem[]>('purchase_items', [defaultItem()])
  const [form, setForm, clearFormDraft] = useDraft('purchase_form', defaultForm)
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('vs_draft_purchase_form')
    if (stored) setHasDraft(true)
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prods }, { data: custs }, { data: locs }, { data: profile }] = await Promise.all([
        supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('customers').select('*').eq('user_id', user.id).order('name'),
        supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('profiles').select('state_code, enable_cnf').eq('id', user.id).single(),
      ])
      setProducts(prods || [])
      setSuppliers(custs || [])
      setLocations(locs || [])
      if (profile) setUserProfile(profile)
      if (locs?.[0] && !form.location_id) setForm(f => ({ ...f, location_id: locs[0].id }))
    }
    load()
  }, [])

  function calcItem(item: LineItem, supplyType: string): LineItem {
    const isInterState = supplyType === 'interstate'
    let unitPrice = item.unit_price
    if (item.priceMode === 'inclusive') {
      unitPrice = (item.enteredPrice || 0) / (1 + item.gst_rate / 100)
    }
    const gst = calculateItemGST({ quantity: item.quantity || 0, unitPrice, discountPct: item.discount_pct || 0, gstRate: item.gst_rate as 0|5|18|40, isInterState })
    return { ...item, unit_price: item.priceMode === 'exclusive' ? item.enteredPrice || 0 : unitPrice, taxable_amount: gst.taxableAmount, cgst_rate: gst.cgstRate, sgst_rate: gst.sgstRate, igst_rate: gst.igstRate, cgst_amount: gst.cgstAmount, sgst_amount: gst.sgstAmount, igst_amount: gst.igstAmount, total_amount: gst.grandTotal }
  }

  function updateItem(key: string, field: string, value: any) {
    setItems(prev => prev.map(item => { if (item._key !== key) return item; const updated = { ...item, [field]: value }; return calcItem(updated, form.supply_type) }))
  }

  function selectProduct(key: string, productId: string) {
    const p = products.find(p => p.id === productId)
    if (!p) return
    setItems(prev => prev.map(item => { if (item._key !== key) return item; const updated = { ...item, product_id: p.id, product_name: p.name, hsn_code: p.hsn_code || '', unit: p.unit, unit_price: p.cost_price, enteredPrice: p.cost_price, gst_rate: p.gst_rate }; return calcItem(updated, form.supply_type) }))
  }

  function selectSupplier(id: string) {
    const s = suppliers.find(c => c.id === id)
    if (!s) { setForm(f => ({ ...f, customer_id: '', customer_name: '', customer_gstin: '', customer_state_code: '', customer_phone: '', customer_address: '', supply_type: 'intrastate' })); return }
    const isInter = s.state_code && s.state_code !== userProfile.state_code ? 'interstate' : 'intrastate'
    setForm(f => ({ ...f, customer_id: s.id, customer_name: s.name, customer_gstin: s.gstin || '', customer_state_code: s.state_code, customer_phone: s.phone || '', customer_address: s.address || '', supply_type: isInter }))
    setItems(prev => prev.map(item => calcItem(item, isInter)))
  }

  function handlePhoneChange(phone: string) {
    setForm(f => ({ ...f, customer_phone: phone }))
    if (phone.length >= 10 && !form.customer_id) {
      const match = suppliers.find(c => c.phone?.includes(phone) || phone.includes(c.phone))
      if (match) selectSupplier(match.id)
    }
  }

  const mappedItems = items.map(i => ({ taxableAmount: i.taxable_amount, cgstAmount: i.cgst_amount, sgstAmount: i.sgst_amount, igstAmount: i.igst_amount, totalAmount: i.total_amount }))
  const totals = calculateInvoiceTotals(mappedItems)
  const isInterState = form.supply_type === 'interstate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some(i => !i.product_name)) { alert('All line items must have a product name'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let finalCustomerId = form.customer_id
    if (!finalCustomerId && form.customer_phone) {
      const { data: newCust, error: custErr } = await supabase.from('customers').insert({
        user_id: user.id,
        name: form.customer_name || 'Walk-in Vendor',
        phone: form.customer_phone,
        address: form.customer_address,
        gstin: form.customer_gstin || null,
        state_code: form.customer_state_code,
        customer_type: 'vendor'
      }).select().single()
      if (!custErr && newCust) finalCustomerId = newCust.id
    }

    const billNum = form.bill_number || `PUR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`

    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: user.id, invoice_number: billNum, invoice_type: 'purchase',
      customer_id: finalCustomerId || null, customer_name: form.customer_name || 'Walk-in Vendor',
      customer_gstin: form.customer_gstin, customer_state_code: form.customer_state_code,
      supply_type: form.supply_type, invoice_date: form.invoice_date,
      subtotal: totals.subtotal, taxable_amount: totals.taxableAmount,
      cgst_amount: totals.cgstAmount, sgst_amount: totals.sgstAmount, igst_amount: totals.igstAmount,
      total_gst: totals.totalGST, grand_total: totals.grandTotal,
      amount_paid: parseFloat(form.amount_paid) || (form.payment_status === 'paid' ? totals.grandTotal : 0),
      payment_status: form.payment_status, location_id: form.location_id || null, notes: form.notes,
      status: 'active'
    }).select().single()

    if (error) { alert(error.message); setLoading(false); return }

    const lineItems = items.map(({ _key, priceMode, enteredPrice, ...item }) => ({ ...item, invoice_id: invoice.id }))
    await supabase.from('invoice_items').insert(lineItems)

    // Update Weighted Average Cost (WAC) for each product
    for (const item of items) {
      if (!item.product_id) continue
      
      // 1. Fetch current total stock and current cost price
      const [{ data: stockData }, { data: productData }] = await Promise.all([
        supabase.from('stock_summary').select('current_stock').eq('product_id', item.product_id),
        supabase.from('products').select('cost_price').eq('id', item.product_id).single()
      ])

      const currentStock = stockData?.reduce((s, entry) => s + (entry.current_stock || 0), 0) || 0
      const currentCost = productData?.cost_price || 0
      const newQty = item.quantity || 0
      const newUnitPrice = item.unit_price || 0 // This is the taxable amount per unit

      if (currentStock + newQty > 0) {
        const newWAC = ((currentStock * currentCost) + (newQty * newUnitPrice)) / (currentStock + newQty)
        
        // 2. Update product master with the new average cost
        await supabase.from('products').update({ cost_price: newWAC }).eq('id', item.product_id)
      }
    }

    const movements = items.filter(i => i.product_id && form.location_id).map(i => ({
      user_id: user.id, product_id: i.product_id, location_id: form.location_id,
      quantity: i.quantity, movement_type: 'purchase', reference_id: invoice.id, reference_type: 'invoice'
    }))
    if (movements.length > 0) await supabase.from('stock_ledger').insert(movements)

    clearFormDraft(); clearItemsDraft()
    router.refresh()
    router.push('/purchases')
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Add Purchase</h1>
          <p className="page-subtitle">Record supplier inwards and update stock</p>
        </div>
        {hasDraft && (
          <div className="alert alert-info" style={{ padding:'8px 12px', fontSize:'0.8rem' }}>
            <Icons.Info size={14} /> Draft restored &mdash; <button onClick={() => { clearFormDraft(); clearItemsDraft(); setForm(defaultForm); setItems([defaultItem()]); setHasDraft(false) }} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', textDecoration:'underline' }}>Clear draft</button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-1 gap-5">

          {/* Supplier & Meta */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Supplier Details</h3>
            <div className="grid grid-1 md:grid-2 gap-4">
              <div className="form-group md:col-span-2">
                <label className="form-label">Supplier / Vendor</label>
                <select className="form-select" value={form.customer_id} onChange={e => selectSupplier(e.target.value)}>
                  <option value="">Walk-in Vendor</option>
                  {suppliers.filter(c => ['vendor','b2b'].includes(c.customer_type)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group md:col-span-2">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="e.g. 9876543210 (Auto-fetches details)" value={form.customer_phone} onChange={e => handlePhoneChange(e.target.value)} />
              </div>
              {!form.customer_id && (
                <div className="form-group md:col-span-2">
                  <label className="form-label">Supplier Name</label>
                  <input className="form-input" placeholder="Vendor name" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
              )}
              <div className="form-group md:col-span-4">
                <label className="form-label">Vendor Address</label>
                <input className="form-input" placeholder="Billing Address..." value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Bill # <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(optional)</span></label>
                <input className="form-input" placeholder="e.g. INV-001 (auto if empty)" value={form.bill_number} onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Bill Date</label>
                <input className="form-input" type="date" required value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              {userProfile.enable_cnf && (
                <div className="form-group md:col-span-2">
                  <label className="form-label">Receive at Location</label>
                  <select className="form-select" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                    <option value="">— No Location —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Procured Items</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
              {items.map((item) => (
                <div key={item._key} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', border:'1px solid var(--border-subtle)' }}>
                  {/* Row 1: Product + Price Mode */}
                  <div className="sale-item-grid">
                    <div className="form-group">
                      <label className="form-label">Product</label>
                      <SearchableSelect
                        options={products.map(p => ({ id: p.id, name: p.name, sub: `Last Cost: ₹${p.cost_price || 0} | Unit: ${p.unit || 'unit'}` }))}
                        value={item.product_id || ''}
                        onChange={(val) => selectProduct(item._key, val)}
                        placeholder="— Search Product —"
                      />
                    </div>
                    <div className="form-group" style={{ flex:'1 1 80px', minWidth:80 }}>
                      <label className="form-label">Qty</label>
                      <input className="form-input" type="number" min="0.001" step="0.001" required value={item.quantity} onChange={e => updateItem(item._key, 'quantity', parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GST %</label>
                      <select className="form-select" value={item.gst_rate} onChange={e => updateItem(item._key,'gst_rate',parseFloat(e.target.value))}>
                        {GST_SLABS.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Row 2: Price mode + amount */}
                  <div className="sale-item-grid" style={{ marginTop:'var(--space-3)', alignItems:'flex-end' }}>
                    <div className="form-group">
                      <label className="form-label">Price Mode</label>
                      <div style={{ display:'flex', gap:4 }}>
                        {(['exclusive','inclusive'] as const).map(m => (
                          <button key={m} type="button" className={`tab ${item.priceMode===m?'active':''}`} style={{ flex:1, fontSize:'0.75rem', padding:'6px 4px' }} onClick={() => updateItem(item._key,'priceMode',m)}>
                            {m==='exclusive'?'+ GST':'Incl.'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex:'1 1 120px' }}>
                      <label className="form-label">{item.priceMode==='inclusive'?'MRP (Incl. GST)':'Cost/Unit (₹)'}</label>
                      <input className="form-input" type="number" min="0" step="0.01" required value={item.enteredPrice||''} onChange={e => { const v=parseFloat(e.target.value)||0; updateItem(item._key,'enteredPrice',v); if(item.priceMode==='exclusive') updateItem(item._key,'unit_price',v) }} />
                    </div>
                    <div style={{ flex:'1 1 100px', display:'flex', flexDirection:'column', gap:4 }}>
                      <span className="form-label">Total</span>
                      <div style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--brand-primary-light)', height: 38, display: 'flex', alignItems: 'center' }}>{formatINR(item.total_amount)}</div>
                    </div>
                    {items.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)', alignSelf:'flex-end', marginBottom: 4 }} onClick={() => setItems(p=>p.filter(i=>i._key!==item._key))}>
                        <Icons.Trash size={15} />
                      </button>
                    )}
                  </div>
                  {/* GST breakdown mini */}
                  <div style={{ display:'flex', gap:'var(--space-4)', marginTop:'var(--space-2)', fontSize:'0.72rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
                    <span>Taxable: {formatINR(item.taxable_amount)}</span>
                    {isInterState ? <span>IGST ({item.igst_rate}%): {formatINR(item.igst_amount)}</span>
                      : <><span>CGST: {formatINR(item.cgst_amount)}</span><span>SGST: {formatINR(item.sgst_amount)}</span></>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }} onClick={() => setItems(p=>[...p,defaultItem()])}>
              <Icons.Plus size={14} /> Add Item
            </button>
          </div>

          {/* Payment + Summary */}
          <div className="grid grid-1 md:grid-2 gap-5">
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Payment</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={form.payment_status} onChange={e => setForm(f=>({...f,payment_status:e.target.value}))}>
                    <option value="paid">Fully Paid</option>
                    <option value="partial">Partial Payment</option>
                    <option value="unpaid">Credit / Unpaid</option>
                  </select>
                </div>
                {form.payment_status==='partial' && (
                  <div className="form-group">
                    <label className="form-label">Amount Paid (₹)</label>
                    <input className="form-input" type="number" min="0" value={form.amount_paid} onChange={e=>setForm(f=>({...f,amount_paid:e.target.value}))} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" style={{ minHeight:70 }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Summary</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
                <div className="gst-breakdown-row"><span>Subtotal</span><span className="font-mono">{formatINR(totals.subtotal)}</span></div>
                <div className="gst-breakdown-row"><span>Total GST (ITC)</span><span className="font-mono" style={{ color:'var(--brand-primary-light)' }}>{formatINR(totals.totalGST)}</span></div>
                <div className="gst-breakdown-row total"><span>Grand Total</span><span className="font-mono" style={{ color:'var(--brand-success)', fontSize:'1.2rem' }}>{formatINR(totals.grandTotal)}</span></div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop:'var(--space-5)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }} disabled={loading}>
                <Icons.Check size={16} />
                {loading ? 'Saving...' : 'Save Purchase & Update Stock'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
