'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR, numberToWords } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import { format } from 'date-fns'
import type { Invoice, InvoiceItem, Profile } from '@/lib/types'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountAmt, setDiscountAmt] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: inv }, { data: invItems }, { data: prof }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])
    setInvoice(inv); setItems(invItems || []); setProfile(prof)
    setLoading(false)
  }

  async function markPaid() {
    await supabase.from('invoices').update({ payment_status: 'paid', amount_paid: invoice?.grand_total }).eq('id', id)
    setInvoice(i => i ? { ...i, payment_status: 'paid', amount_paid: i.grand_total } : i)
  }

  async function applyDiscount() {
    const disc = parseFloat(discountAmt)
    if (!disc || disc <= 0 || !invoice) return
    setApplyingDiscount(true)
    const totalTaxable = items.reduce((s, i) => s + i.taxable_amount, 0)
    const updatedItems = items.map(item => {
      const share = item.taxable_amount / totalTaxable
      const itemDisc = disc * share
      const newTaxable = Math.max(0, item.taxable_amount - itemDisc)
      const newTotal = newTaxable * (1 + item.gst_rate / 100)
      const newCgst = invoice.supply_type === 'intrastate' ? newTaxable * (item.cgst_rate / 100) : 0
      const newSgst = invoice.supply_type === 'intrastate' ? newTaxable * (item.sgst_rate / 100) : 0
      const newIgst = invoice.supply_type === 'interstate' ? newTaxable * (item.igst_rate / 100) : 0
      return { ...item, taxable_amount: newTaxable, cgst_amount: newCgst, sgst_amount: newSgst, igst_amount: newIgst, total_amount: newTotal }
    })
    const newGrandTotal = invoice.grand_total - disc
    const newTotalGST = updatedItems.reduce((s, i) => s + i.cgst_amount + i.sgst_amount + i.igst_amount, 0)

    await Promise.all([
      supabase.from('invoices').update({
        grand_total: newGrandTotal, taxable_amount: totalTaxable - disc, total_gst: newTotalGST,
        cash_discount: (invoice.cash_discount || 0) + disc,
        cash_discount_note: discountNote || 'Cash discount applied',
      }).eq('id', id),
      ...updatedItems.map(item => supabase.from('invoice_items').update({
        taxable_amount: item.taxable_amount, cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount, igst_amount: item.igst_amount, total_amount: item.total_amount,
      }).eq('id', item.id))
    ])

    setDiscountAmt(''); setDiscountNote(''); setShowDiscount(false)
    load()
    setApplyingDiscount(false)
  }

  function generateEwayJSON() {
    if (!invoice || !profile) return
    const payload = {
      version: "1.0.1",
      billLists: [{
        fromGstin: profile.gstin || "YOUR_GSTIN",
        fromTrdName: profile.business_name || "",
        fromAddr1: profile.address || "",
        fromPlace: profile.city || "",
        fromPincode: profile.pincode || "000000",
        fromStateCode: parseInt(profile.state_code || "27"),
        toGstin: invoice.customer_gstin || "URP",
        toTrdName: invoice.customer_name || "",
        toAddr1: "",
        toPlace: "",
        toPincode: "000000",
        toStateCode: parseInt(invoice.customer_state_code || profile.state_code || "27"),
        transactionType: 1,
        otherValue: 0,
        totalValue: invoice.taxable_amount,
        cgstValue: invoice.cgst_amount,
        sgstValue: invoice.sgst_amount,
        igstValue: invoice.igst_amount,
        cessValue: 0,
        cessNonAdvolValue: 0,
        totInvValue: invoice.grand_total,
        supplyType: invoice.supply_type === "interstate" ? "O" : "I",
        subSupplyType: 1,
        docType: "INV",
        docNo: invoice.invoice_number,
        docDate: format(new Date(invoice.invoice_date), "dd/MM/yyyy"),
        transMode: "1",
        transDistance: "0",
        itemList: items.map((item, idx) => ({
          itemNo: idx + 1,
          productName: item.product_name,
          productDesc: item.product_name,
          hsnCode: item.hsn_code || "0000",
          quantity: item.quantity,
          qtyUnit: (item.unit || "NOS").toUpperCase().slice(0, 3),
          cgstRate: item.cgst_rate || 0,
          sgstRate: item.sgst_rate || 0,
          igstRate: item.igst_rate || 0,
          cessRate: 0,
          taxableAmount: item.taxable_amount,
        }))
      }]
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `EwayBill_${invoice.invoice_number}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}><div className="skeleton" style={{ width:'100%', height:400 }} /></div>
  if (!invoice) return <div className="empty-state"><h3>Invoice not found</h3></div>

  const isInter = invoice.supply_type === 'interstate'

  return (
    <div className="animate-fade">
      <div className="page-header no-print">
        <div className="page-header-left">
          <h1 className="page-title">{invoice.invoice_number}</h1>
          <p className="page-subtitle">{format(new Date(invoice.invoice_date), 'dd MMMM yyyy')}
            {(invoice as any).edit_count > 0 && <span className="badge badge-warning" style={{ marginLeft:8, fontSize:'0.7rem' }}>Edited ×{(invoice as any).edit_count}</span>}
          </p>
        </div>
        <div className="page-actions">
          {invoice.payment_status !== 'paid' && (
            <button className="btn btn-success" onClick={markPaid} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Check size={15} /> Mark Paid
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowDiscount(!showDiscount)} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Zap size={15} /> Cash Discount
          </button>
          <button className="btn btn-secondary" onClick={generateEwayJSON} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Download size={15} /> E-Way JSON
          </button>
          <button className="btn btn-secondary" onClick={() => router.push(`/sales/${id}/edit`)} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Edit size={15} /> Edit
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.FileText size={15} /> Print
          </button>
        </div>
      </div>

      {/* Status Row */}
      <div className="no-print" style={{ marginBottom:'var(--space-4)', display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'center' }}>
        {invoice.payment_status === 'paid' && <span className="badge badge-paid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>Paid in Full</span>}
        {invoice.payment_status === 'partial' && <span className="badge badge-partial" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>Partial — {formatINR(invoice.amount_paid)} received</span>}
        {invoice.payment_status === 'unpaid' && <span className="badge badge-unpaid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>{formatINR(invoice.grand_total)} due</span>}
        <span className="badge badge-secondary" style={{ fontSize:'0.85rem', padding:'6px 12px', textTransform:'capitalize' }}>{invoice.supply_type}</span>
        {(invoice as any).cash_discount > 0 && <span className="badge badge-warning" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>Disc: {formatINR((invoice as any).cash_discount)}</span>}
      </div>

      {/* Cash Discount Panel */}
      {showDiscount && (
        <div className="card no-print" style={{ marginBottom:'var(--space-4)', borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.04)' }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:700, marginBottom:'var(--space-3)', color:'var(--brand-warning)' }}>Apply Cash Discount</h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'var(--space-3)' }}>
            The discount will be proportionally distributed across all line items. GST will recalculate on the reduced taxable value.
          </p>
          <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap' }}>
            <div className="form-group" style={{ flex:'1 1 160px' }}>
              <label className="form-label">Discount Amount (₹)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={discountAmt} onChange={e=>setDiscountAmt(e.target.value)} placeholder="e.g. 500" />
            </div>
            <div className="form-group" style={{ flex:'2 1 200px' }}>
              <label className="form-label">Reason / Note</label>
              <input className="form-input" value={discountNote} onChange={e=>setDiscountNote(e.target.value)} placeholder="e.g. Early payment discount" />
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'var(--space-2)' }}>
              <button className="btn btn-primary" onClick={applyDiscount} disabled={applyingDiscount || !discountAmt} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Icons.Check size={15} />{applyingDiscount ? 'Applying...' : 'Apply Discount'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowDiscount(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print View */}
      <div className="invoice-preview" id="invoice-print">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'2rem', borderBottom:'2px solid #e2e8f0', paddingBottom:'1.5rem' }}>
          <div>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:'#1e293b', letterSpacing:'-0.03em' }}>{profile?.business_name || 'My Business'}</div>
            {profile?.gstin && <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:4 }}>GSTIN: {profile.gstin}</div>}
            <div style={{ fontSize:'0.82rem', color:'#64748b', marginTop:2 }}>{profile?.address}{profile?.city ? `, ${profile.city}` : ''}</div>
            <div style={{ fontSize:'0.82rem', color:'#64748b' }}>{profile?.state_name}{profile?.pincode ? ` — ${profile.pincode}` : ''}</div>
            {profile?.phone && <div style={{ fontSize:'0.82rem', color:'#64748b' }}>Ph: {profile.phone}</div>}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:900, color:'#6366f1', letterSpacing:'-0.05em' }}>TAX INVOICE</div>
            <div style={{ fontSize:'0.9rem', fontWeight:700, color:'#334155', marginTop:4 }}>#{invoice.invoice_number}</div>
            <div style={{ fontSize:'0.82rem', color:'#64748b' }}>Date: {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'1.5rem' }}>
          <div>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Bill To</div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:'#1e293b' }}>{invoice.customer_name || 'Walk-in Customer'}</div>
            {invoice.customer_gstin && <div style={{ fontSize:'0.8rem', color:'#64748b' }}>GSTIN: {invoice.customer_gstin}</div>}
            {invoice.customer_state_code && <div style={{ fontSize:'0.8rem', color:'#64748b' }}>State Code: {invoice.customer_state_code}</div>}
          </div>
          <div>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Supply Details</div>
            <div style={{ fontSize:'0.85rem', color:'#334155', textTransform:'capitalize' }}>Type: {invoice.supply_type}</div>
            <div style={{ fontSize:'0.85rem', color:'#334155', textTransform:'capitalize' }}>Payment: {invoice.payment_method}</div>
            {profile?.bank_name && <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:4 }}>Bank: {profile.bank_name} | A/c: {profile.bank_account} | IFSC: {profile.bank_ifsc}</div>}
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'1.5rem', tableLayout:'fixed' }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['#','Product / Service','HSN','Qty','Rate','Taxable'].concat(
                  isInter ? ['IGST%','IGST'] : ['CGST%','CGST','SGST%','SGST']
                ).concat(['Total']).map((h, i) => (
                  <th key={i} style={{ padding:'8px 8px', textAlign:i===0?'center':'left', fontSize:'0.7rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e2e8f0', overflow:'hidden', wordBreak:'break-word' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'8px', textAlign:'center', fontSize:'0.8rem', color:'#94a3b8' }}>{idx+1}</td>
                  <td style={{ padding:'8px', fontSize:'0.85rem', fontWeight:600, color:'#1e293b', wordBreak:'break-word' }}>{item.product_name}</td>
                  <td style={{ padding:'8px', fontSize:'0.75rem', color:'#64748b', fontFamily:'monospace' }}>{item.hsn_code||'—'}</td>
                  <td style={{ padding:'8px', fontSize:'0.82rem' }}>{item.quantity} {item.unit}</td>
                  <td style={{ padding:'8px', fontSize:'0.82rem', fontFamily:'monospace' }}>₹{item.unit_price.toFixed(2)}</td>
                  <td style={{ padding:'8px', fontSize:'0.82rem', fontFamily:'monospace' }}>₹{item.taxable_amount.toFixed(2)}</td>
                  {isInter ? (
                    <><td style={{ padding:'8px', fontSize:'0.82rem', color:'#6366f1' }}>{item.igst_rate}%</td><td style={{ padding:'8px', fontSize:'0.82rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.igst_amount.toFixed(2)}</td></>
                  ) : (
                    <><td style={{ padding:'8px', fontSize:'0.82rem', color:'#6366f1' }}>{item.cgst_rate}%</td><td style={{ padding:'8px', fontSize:'0.82rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.cgst_amount.toFixed(2)}</td>
                    <td style={{ padding:'8px', fontSize:'0.82rem', color:'#6366f1' }}>{item.sgst_rate}%</td><td style={{ padding:'8px', fontSize:'0.82rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.sgst_amount.toFixed(2)}</td></>
                  )}
                  <td style={{ padding:'8px', fontSize:'0.88rem', fontWeight:700, fontFamily:'monospace', color:'#1e293b' }}>₹{item.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1.5rem' }}>
          <div style={{ minWidth:280 }}>
            {[
              ['Subtotal', formatINR(invoice.subtotal)],
              isInter ? ['IGST', formatINR(invoice.igst_amount)] : null,
              !isInter ? ['CGST', formatINR(invoice.cgst_amount)] : null,
              !isInter ? ['SGST', formatINR(invoice.sgst_amount)] : null,
              ['Total GST', formatINR(invoice.total_gst)],
              (invoice as any).cash_discount > 0 ? ['Cash Discount', `— ${formatINR((invoice as any).cash_discount)}`] : null,
            ].filter(Boolean).map((row, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'0.875rem', color:'#475569', borderBottom:'1px solid #f1f5f9' }}>
                <span>{(row as string[])[0]}</span><span style={{ fontFamily:'monospace' }}>{(row as string[])[1]}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:'1.1rem', fontWeight:800, color:'#1e293b', borderTop:'2px solid #e2e8f0', marginTop:4 }}>
              <span>Grand Total</span><span style={{ fontFamily:'monospace', color:'#16a34a' }}>{formatINR(invoice.grand_total)}</span>
            </div>
            {invoice.payment_status === 'partial' && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:'1rem', fontWeight:700, color:'#b45309', marginTop:4 }}>
                <span>Amount Due</span><span style={{ fontFamily:'monospace' }}>{formatINR(invoice.grand_total - invoice.amount_paid)}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ background:'#f8fafc', padding:'10px 14px', borderRadius:8, fontSize:'0.82rem', color:'#475569', marginBottom:'1.5rem' }}>
          <strong>Amount in Words:</strong> {numberToWords(invoice.grand_total)}
        </div>
        {invoice.notes && <div style={{ fontSize:'0.82rem', color:'#64748b', marginBottom:'1rem' }}><strong>Notes:</strong> {invoice.notes}</div>}
        {(invoice as any).cash_discount_note && <div style={{ fontSize:'0.82rem', color:'#92400e', marginBottom:'1rem' }}><strong>Discount Note:</strong> {(invoice as any).cash_discount_note}</div>}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderTop:'1px solid #e2e8f0', paddingTop:'1rem', marginTop:'1rem' }}>
          <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>Computer generated invoice · Vertex Suite</div>
          <div style={{ textAlign:'right' }}>
            <div style={{ height:40, borderBottom:'1px solid #94a3b8', width:180, marginBottom:4 }} />
            <div style={{ fontSize:'0.78rem', color:'#64748b' }}>Authorised Signatory</div>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#334155' }}>{profile?.business_name}</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .sidebar, .bottom-nav, .topbar { display: none !important; }
          .main-content { margin: 0 !important; }
          .page-content { padding: 0 !important; }
          .invoice-preview { box-shadow: none; border-radius: 0; }
        }
        @media screen {
          .invoice-preview table { table-layout: fixed; word-break: break-word; }
        }
      `}</style>
    </div>
  )
}
