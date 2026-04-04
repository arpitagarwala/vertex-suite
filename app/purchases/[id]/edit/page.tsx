'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateItemGST, calculateInvoiceTotals, formatINR } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import type { Product, Location } from '@/lib/types'

const GST_SLABS = [0, 5, 18, 40]

interface LineItem { _key: string; id?: string; product_id: string | null; product_name: string; hsn_code: string; quantity: number; unit: string; unit_price: number; discount_pct: number; gst_rate: number; taxable_amount: number; cgst_rate: number; sgst_rate: number; igst_rate: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }

export default function EditPurchasePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [originalInvoice, setOriginalInvoice] = useState<any>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [form, setForm] = useState({
    customer_name: '', customer_gstin: '', supply_type: 'intrastate',
    invoice_date: '', payment_status: 'paid', amount_paid: '', notes: '', location_id: '', bill_number: '',
  })

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: inv }, { data: invItems }, { data: prods }, { data: locs }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id),
      supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('locations').select('*').eq('user_id', user.id).eq('is_active', true),
    ])
    if (!inv) { router.push('/purchases'); return }
    setOriginalInvoice(inv)
    setProducts(prods || [])
    setLocations(locs || [])
    setForm({
      customer_name: inv.customer_name || '', customer_gstin: inv.customer_gstin || '',
      supply_type: inv.supply_type || 'intrastate', invoice_date: inv.invoice_date || '',
      payment_status: inv.payment_status || 'paid', amount_paid: inv.amount_paid?.toString() || '',
      notes: inv.notes || '', location_id: inv.location_id || '', bill_number: inv.invoice_number || '',
    })
    setItems((invItems || []).map(i => ({
      _key: i.id, id: i.id, product_id: i.product_id, product_name: i.product_name,
      hsn_code: i.hsn_code || '', quantity: i.quantity, unit: i.unit, unit_price: i.unit_price,
      discount_pct: i.discount_pct || 0, gst_rate: i.gst_rate,
      taxable_amount: i.taxable_amount, cgst_rate: i.cgst_rate, sgst_rate: i.sgst_rate, igst_rate: i.igst_rate,
      cgst_amount: i.cgst_amount, sgst_amount: i.sgst_amount, igst_amount: i.igst_amount, total_amount: i.total_amount,
    })))
    setPageLoading(false)
  }

  function calcItem(item: LineItem, supplyType: string): LineItem {
    const isInterState = supplyType === 'interstate'
    const gst = calculateItemGST({ quantity: item.quantity || 0, unitPrice: item.unit_price || 0, discountPct: item.discount_pct || 0, gstRate: item.gst_rate as 0|5|18|40, isInterState })
    return { ...item, taxable_amount: gst.taxableAmount, cgst_rate: gst.cgstRate, sgst_rate: gst.sgstRate, igst_rate: gst.igstRate, cgst_amount: gst.cgstAmount, sgst_amount: gst.sgstAmount, igst_amount: gst.igstAmount, total_amount: gst.grandTotal }
  }

  function updateItem(key: string, field: string, value: any) {
    setItems(prev => prev.map(item => { if (item._key !== key) return item; return calcItem({ ...item, [field]: value }, form.supply_type) }))
  }

  const totals = calculateInvoiceTotals(items.map(i => ({ taxableAmount: i.taxable_amount, cgstAmount: i.cgst_amount, sgstAmount: i.sgst_amount, igstAmount: i.igst_amount, totalAmount: i.total_amount })))
  const isInterState = form.supply_type === 'interstate'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm('This will amend the purchase bill and reverse/re-apply stock. Proceed?')) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      // 1. Reverse old stock movements (remove what was added on purchase)
      if (originalInvoice?.location_id) {
        const { data: oldItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)
        if (oldItems) {
          const reversals = oldItems.filter(i => i.product_id).map(i => ({
            user_id: user.id, product_id: i.product_id, location_id: originalInvoice.location_id,
            quantity: -i.quantity, movement_type: 'adjustment',
            notes: `Edit reversal for purchase ${originalInvoice.invoice_number}`,
          }))
          if (reversals.length > 0) await supabase.from('stock_ledger').insert(reversals)
        }
      }
      // 2. Update invoice header
      await supabase.from('invoices').update({
        invoice_number: form.bill_number, customer_name: form.customer_name,
        customer_gstin: form.customer_gstin, supply_type: form.supply_type,
        invoice_date: form.invoice_date, location_id: form.location_id || null,
        payment_status: form.payment_status,
        amount_paid: parseFloat(form.amount_paid) || (form.payment_status === 'paid' ? totals.grandTotal : 0),
        notes: form.notes, subtotal: totals.subtotal, taxable_amount: totals.taxableAmount,
        cgst_amount: totals.cgstAmount, sgst_amount: totals.sgstAmount, igst_amount: totals.igstAmount,
        total_gst: totals.totalGST, grand_total: totals.grandTotal,
        edit_count: (originalInvoice?.edit_count || 0) + 1, last_edited_at: new Date().toISOString(),
      }).eq('id', id)
      // 3. Replace line items
      await supabase.from('invoice_items').delete().eq('invoice_id', id)
      await supabase.from('invoice_items').insert(items.map(({ _key, id: itemId, ...item }) => ({ ...item, invoice_id: id })))
      // 4. Re-apply stock additions
      if (form.location_id) {
        const newMovements = items.filter(i => i.product_id).map(i => ({
          user_id: user.id, product_id: i.product_id, location_id: form.location_id,
          quantity: i.quantity, movement_type: 'purchase', reference_id: id, reference_type: 'invoice',
          notes: `Edit for purchase ${form.bill_number}`,
        }))
        if (newMovements.length > 0) await supabase.from('stock_ledger').insert(newMovements)
      }
      router.push('/purchases')
    } catch (err: any) {
      alert(err.message || 'Error saving changes')
      setLoading(false)
    }
  }

  if (pageLoading) return <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>{[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:120 }} />)}</div>

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Edit Purchase Bill</h1>
          <p className="page-subtitle">{originalInvoice?.invoice_number} · Stock auto-adjusts on save</p>
        </div>
        <div className="alert alert-warning" style={{ padding:'8px 14px', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:8 }}>
          <Icons.AlertTriangle size={14} /> Stock will be reversed and re-applied with new quantities.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gap:'var(--space-5)' }}>
          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Bill Details</h3>
            <div className="purchase-form-grid">
              <div className="form-group">
                <label className="form-label">Vendor Bill # <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(optional)</span></label>
                <input className="form-input" value={form.bill_number} onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Name</label>
                <input className="form-input" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Bill Date</label>
                <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <select className="form-select" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">— Select Location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Items Procured</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
              {items.map(item => (
                <div key={item._key} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', border:'1px solid var(--border-subtle)' }}>
                  <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'flex-end' }}>
                    <div className="form-group" style={{ flex:'2 1 200px' }}>
                      <label className="form-label">Product</label>
                      <div style={{ display:'flex', gap:6 }}>
                        <select className="form-select" style={{ flex:1 }} value={item.product_id || ''} onChange={e => {
                          const p = products.find(p => p.id === e.target.value)
                          if (p) updateItem(item._key, 'product_id', p.id)
                        }}>
                          <option value="">— Select —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <input className="form-input" style={{ marginTop:4, fontSize:'0.8rem' }} placeholder="Product name" value={item.product_name}
                        onChange={e => updateItem(item._key, 'product_name', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex:'0 0 80px' }}>
                      <label className="form-label">Qty</label>
                      <input className="form-input" type="number" min="0" step="0.001" value={item.quantity} onChange={e => updateItem(item._key, 'quantity', parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="form-group" style={{ flex:'0 0 110px' }}>
                      <label className="form-label">Cost/Unit (₹)</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(item._key, 'unit_price', parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="form-group" style={{ flex:'0 0 90px' }}>
                      <label className="form-label">GST %</label>
                      <select className="form-select" value={item.gst_rate} onChange={e => updateItem(item._key, 'gst_rate', parseFloat(e.target.value))}>
                        {GST_SLABS.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div style={{ flex:'0 0 90px', display:'flex', flexDirection:'column' }}>
                      <span className="form-label">Total</span>
                      <div style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--brand-primary-light)', padding:'10px 0', fontSize:'0.9rem' }}>{formatINR(item.total_amount)}</div>
                    </div>
                    {items.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)', marginBottom:4 }}
                        onClick={() => setItems(p => p.filter(i => i._key !== item._key))}>
                        <Icons.Trash size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:6, display:'flex', gap:'var(--space-4)', flexWrap:'wrap' }}>
                    <span>Taxable: {formatINR(item.taxable_amount)}</span>
                    {isInterState ? <span>IGST: {formatINR(item.igst_amount)}</span>
                      : <><span>CGST: {formatINR(item.cgst_amount)}</span><span>SGST: {formatINR(item.sgst_amount)}</span></>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:'var(--space-3)', display:'flex', alignItems:'center', gap:6 }}
              onClick={() => setItems(p => [...p, { _key: Math.random().toString(36).slice(2), product_id: null, product_name: '', hsn_code: '', quantity: 1, unit: 'pcs', unit_price: 0, discount_pct: 0, gst_rate: 18, taxable_amount: 0, cgst_rate: 0, sgst_rate: 0, igst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 }])}>
              <Icons.Plus size={14} /> Add Item
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-5)' }}>
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Payment</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                    <option value="paid">Fully Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid / Credit</option>
                  </select>
                </div>
                {form.payment_status === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">Amount Paid (₹)</label>
                    <input className="form-input" type="number" min="0" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Revised Summary</h3>
              <div className="gst-breakdown-row"><span>Subtotal</span><span className="font-mono">{formatINR(totals.subtotal)}</span></div>
              {isInterState ? <div className="gst-breakdown-row"><span>IGST (ITC)</span><span className="font-mono" style={{ color:'var(--brand-success)' }}>{formatINR(totals.igstAmount)}</span></div>
                : <><div className="gst-breakdown-row"><span>CGST (ITC)</span><span className="font-mono" style={{ color:'var(--brand-success)' }}>{formatINR(totals.cgstAmount)}</span></div>
                   <div className="gst-breakdown-row"><span>SGST (ITC)</span><span className="font-mono" style={{ color:'var(--brand-success)' }}>{formatINR(totals.sgstAmount)}</span></div></>}
              <div className="gst-breakdown-row total">
                <span>Grand Total</span>
                <span className="font-mono" style={{ color:'var(--brand-success)', fontSize:'1.2rem' }}>{formatINR(totals.grandTotal)}</span>
              </div>
              <div style={{ display:'flex', gap:'var(--space-3)', marginTop:'var(--space-5)' }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }} disabled={loading}>
                  <Icons.Check size={16} />{loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        .purchase-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media (max-width: 640px) { .purchase-form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
