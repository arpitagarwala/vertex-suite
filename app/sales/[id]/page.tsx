'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR, numberToWords } from '@/lib/gst'
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: inv }, { data: invItems }, { data: prof }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ])
      setInvoice(inv)
      setItems(invItems || [])
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [id])

  function printInvoice() { window.print() }

  async function markPaid() {
    await supabase.from('invoices').update({ payment_status: 'paid', amount_paid: invoice?.grand_total }).eq('id', id)
    setInvoice(i => i ? { ...i, payment_status: 'paid', amount_paid: i.grand_total } : i)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}><div className="animate-spin" style={{ fontSize:'2rem' }}>⏳</div></div>
  if (!invoice) return <div className="empty-state"><h3>Invoice not found</h3></div>

  const isInter = invoice.supply_type === 'interstate'

  return (
    <div className="animate-fade">
      {/* Actions Bar */}
      <div className="page-header no-print">
        <div className="page-header-left">
          <h1 className="page-title">{invoice.invoice_number}</h1>
          <p className="page-subtitle">{format(new Date(invoice.invoice_date), 'dd MMMM yyyy')}</p>
        </div>
        <div className="page-actions">
          {invoice.payment_status !== 'paid' && (
            <button className="btn btn-success" onClick={markPaid}>✅ Mark as Paid</button>
          )}
          <button className="btn btn-secondary" onClick={printInvoice}>🖨️ Print / PDF</button>
          <button className="btn btn-ghost" onClick={() => router.push('/sales')}>← Back</button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="no-print" style={{ marginBottom:'var(--space-5)', display:'flex', gap:'var(--space-3)', flexWrap:'wrap' }}>
        {invoice.payment_status === 'paid' && <span className="badge badge-paid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>✅ Paid</span>}
        {invoice.payment_status === 'partial' && <span className="badge badge-partial" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>⚡ Partial — {formatINR(invoice.amount_paid)} received</span>}
        {invoice.payment_status === 'unpaid' && <span className="badge badge-unpaid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>⏳ Unpaid — {formatINR(invoice.grand_total)} due</span>}
        <span className="badge badge-secondary" style={{ fontSize:'0.85rem', padding:'6px 12px', textTransform:'capitalize' }}>{invoice.supply_type}</span>
        <span className="badge badge-secondary" style={{ fontSize:'0.85rem', padding:'6px 12px', textTransform:'capitalize' }}>{invoice.payment_method}</span>
      </div>

      {/* Invoice Preview */}
      <div className="invoice-preview" id="invoice-print">
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'2rem', borderBottom:'2px solid #e2e8f0', paddingBottom:'1.5rem' }}>
          <div>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:'#1e293b', letterSpacing:'-0.03em' }}>
              {profile?.business_name || 'My Business'}
            </div>
            {profile?.gstin && <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:4 }}>GSTIN: {profile.gstin}</div>}
            <div style={{ fontSize:'0.82rem', color:'#64748b', marginTop:2 }}>{profile?.address}{profile?.city ? `, ${profile.city}` : ''}</div>
            <div style={{ fontSize:'0.82rem', color:'#64748b' }}>{profile?.state_name} — {profile?.pincode}</div>
            {profile?.phone && <div style={{ fontSize:'0.82rem', color:'#64748b' }}>📞 {profile.phone}</div>}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:900, color:'#6366f1', letterSpacing:'-0.05em' }}>TAX INVOICE</div>
            <div style={{ fontSize:'0.9rem', fontWeight:700, color:'#334155', marginTop:4 }}>#{invoice.invoice_number}</div>
            <div style={{ fontSize:'0.82rem', color:'#64748b' }}>Date: {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</div>
            {invoice.due_date && <div style={{ fontSize:'0.82rem', color:'#ef4444' }}>Due: {format(new Date(invoice.due_date), 'dd/MM/yyyy')}</div>}
          </div>
        </div>

        {/* Bill To */}
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
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'1.5rem' }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              {['#','Product / Service','HSN','Qty','Rate','Disc%','Taxable'].concat(
                isInter ? ['IGST%','IGST Amt'] : ['CGST%','CGST Amt','SGST%','SGST Amt']
              ).concat(['Total']).map((h, i) => (
                <th key={i} style={{ padding:'8px 10px', textAlign: i === 0 ? 'center' : 'left', fontSize:'0.72rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                <td style={{ padding:'8px 10px', textAlign:'center', fontSize:'0.85rem', color:'#94a3b8' }}>{idx+1}</td>
                <td style={{ padding:'8px 10px', fontSize:'0.9rem', fontWeight:600, color:'#1e293b' }}>{item.product_name}</td>
                <td style={{ padding:'8px 10px', fontSize:'0.8rem', color:'#64748b', fontFamily:'monospace' }}>{item.hsn_code || '—'}</td>
                <td style={{ padding:'8px 10px', fontSize:'0.85rem' }}>{item.quantity} {item.unit}</td>
                <td style={{ padding:'8px 10px', fontSize:'0.85rem', fontFamily:'monospace' }}>₹{item.unit_price.toFixed(2)}</td>
                <td style={{ padding:'8px 10px', fontSize:'0.85rem', color:'#64748b' }}>{item.discount_pct}%</td>
                <td style={{ padding:'8px 10px', fontSize:'0.85rem', fontFamily:'monospace' }}>₹{item.taxable_amount.toFixed(2)}</td>
                {isInter ? (
                  <><td style={{ padding:'8px 10px', fontSize:'0.85rem', color:'#6366f1' }}>{item.igst_rate}%</td>
                  <td style={{ padding:'8px 10px', fontSize:'0.85rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.igst_amount.toFixed(2)}</td></>
                ) : (
                  <><td style={{ padding:'8px 10px', fontSize:'0.85rem', color:'#6366f1' }}>{item.cgst_rate}%</td>
                  <td style={{ padding:'8px 10px', fontSize:'0.85rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.cgst_amount.toFixed(2)}</td>
                  <td style={{ padding:'8px 10px', fontSize:'0.85rem', color:'#6366f1' }}>{item.sgst_rate}%</td>
                  <td style={{ padding:'8px 10px', fontSize:'0.85rem', fontFamily:'monospace', color:'#6366f1' }}>₹{item.sgst_amount.toFixed(2)}</td></>
                )}
                <td style={{ padding:'8px 10px', fontSize:'0.9rem', fontWeight:700, fontFamily:'monospace', color:'#1e293b' }}>₹{item.total_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1.5rem' }}>
          <div style={{ minWidth:280 }}>
            {[
              ['Subtotal', formatINR(invoice.subtotal)],
              isInter ? ['IGST', formatINR(invoice.igst_amount)] : null,
              !isInter ? ['CGST', formatINR(invoice.cgst_amount)] : null,
              !isInter ? ['SGST', formatINR(invoice.sgst_amount)] : null,
              ['Total GST', formatINR(invoice.total_gst)],
            ].filter(Boolean).map((row, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'0.875rem', color:'#475569', borderBottom:'1px solid #f1f5f9' }}>
                <span>{(row as string[])[0]}</span><span style={{ fontFamily:'monospace' }}>{(row as string[])[1]}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', fontSize:'1.1rem', fontWeight:800, color:'#1e293b', borderTop:'2px solid #e2e8f0', marginTop:4 }}>
              <span>Grand Total</span><span style={{ fontFamily:'monospace', color:'#16a34a' }}>{formatINR(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div style={{ background:'#f8fafc', padding:'10px 14px', borderRadius:8, fontSize:'0.82rem', color:'#475569', marginBottom:'1.5rem' }}>
          <strong>Amount in Words:</strong> {numberToWords(invoice.grand_total)}
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ fontSize:'0.82rem', color:'#64748b', marginBottom:'1rem' }}>
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderTop:'1px solid #e2e8f0', paddingTop:'1rem', marginTop:'1rem' }}>
          <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>This is a computer generated invoice</div>
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
          .invoice-preview { box-shadow: none; border-radius: 0; color: #000; }
        }
      `}</style>
    </div>
  )
}
