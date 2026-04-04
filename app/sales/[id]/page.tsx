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

      {/* Professional Invoice Print & Preview View */}
      <div className="invoice-container desktop-only" id="invoice-print">
        {/* Master Table for Multi-page Page Header Repetition */}
        <table className="invoice-master-table">
          <thead>
            <tr>
              <td>
                <div className="invoice-box no-border-bottom">
                  {/* Title */}
                  <div className="invoice-header-row">
                    <div className="invoice-header-title">TAX INVOICE</div>
                  </div>

                  {/* Business & Details Section */}
                  <div className="invoice-grid-2">
                    <div className="invoice-info-box border-right">
                      <div className="label-sm">Consignor (Seller)</div>
                      <div className="business-main-name">{profile?.business_name}</div>
                      <div className="text-sm">{profile?.address}</div>
                      <div className="text-sm">{profile?.city}, {profile?.state_name} - {profile?.pincode}</div>
                      <div className="text-sm">GSTIN/UIN: <strong>{profile?.gstin}</strong></div>
                      <div className="text-sm">State Name: {profile?.state_name}, Code: {profile?.state_code}</div>
                      {profile?.phone && <div className="text-sm">Contact: {profile.phone}</div>}
                    </div>
                    <div className="invoice-info-box">
                      <div className="grid-details">
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Invoice No.</div>
                          <div className="value-sm"><strong>{invoice.invoice_number}</strong></div>
                        </div>
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Dated</div>
                          <div className="value-sm"><strong>{format(new Date(invoice.invoice_date), 'dd-MMM-yyyy')}</strong></div>
                        </div>
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Mode/Terms of Payment</div>
                          <div className="value-sm">{invoice.payment_method}</div>
                        </div>
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Supply Type</div>
                          <div className="value-sm" style={{ textTransform:'capitalize' }}>{invoice.supply_type}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Consignee Section */}
                  <div className="invoice-info-box border-top border-bottom">
                    <div className="label-sm">Consignee (Buyer)</div>
                    <div className="business-sub-name">{invoice.customer_name || 'Walk-in Customer'}</div>
                    {invoice.customer_gstin && <div className="text-sm">GSTIN/UIN: <strong>{invoice.customer_gstin}</strong></div>}
                    {invoice.customer_state_code && <div className="text-sm">State Code: {invoice.customer_state_code}</div>}
                  </div>
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <table className="invoice-item-table items-list">
                  <thead>
                    <tr>
                      <th style={{ width: '8%', whiteSpace: 'nowrap' }}>S.No.</th>
                      <th style={{ width: '37%' }}>Description of Goods</th>
                      <th style={{ width: '12%', whiteSpace: 'nowrap' }}>HSN/SAC</th>
                      <th style={{ width: '8%' }}>Qty</th>
                      <th style={{ width: '12%' }}>Rate</th>
                      <th style={{ width: '8%', whiteSpace: 'nowrap' }}>per</th>
                      <th style={{ width: '15%' }}>Amount</th>
                    </tr>
                  </thead>
                   <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ textAlign:'center' }}>{idx+1}</td>
                          <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ textAlign:'center' }}>{item.hsn_code||''}</td>
                          <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{item.quantity} {item.unit}</td>
                          <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{item.unit_price.toFixed(2)}</td>
                          <td style={{ textAlign:'center' }}>{item.unit}</td>
                          <td style={{ textAlign:'right', fontWeight: 600, whiteSpace:'nowrap' }}>{item.total_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Spacer rows */}
                      {[...Array(Math.max(0, 10 - items.length))].map((_, i) => (
                        <tr key={`space-${i}`} className="spacer-row">
                          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </td>
            </tr>
          </tbody>

          <tfoot>
             <tr>
               <td>
                  <div className="invoice-box no-border-top">
                    {/* Item Total Row */}
                    <table className="invoice-item-table totals-list">
                      <tfoot>
                        <tr className="total-row">
                          <td style={{ width: '85%', textAlign:'right', fontWeight:700 }}>Total</td>
                          <td style={{ width: '15%', textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{formatINR(invoice.grand_total)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Math Summary & Tax Breakdown */}
                    <div className="invoice-grid-2 border-top">
                      <div className="invoice-info-box border-right">
                        <div className="label-sm">Amount Chargeable (in words)</div>
                        <div className="text-sm" style={{ fontWeight:700, textTransform:'capitalize' }}>Indian Rupees {numberToWords(invoice.grand_total)} Only</div>
                        
                        <div className="tax-summary-box border-top" style={{ marginTop: 10 }}>
                          <table className="tax-table">
                            <thead>
                              <tr>
                                <th style={{ whiteSpace:'nowrap' }}>Taxable Val</th>
                                {isInter ? <th style={{ whiteSpace:'nowrap' }}>IGST%</th> : <><th colSpan={2} style={{ whiteSpace:'nowrap' }}>CGST</th><th colSpan={2} style={{ whiteSpace:'nowrap' }}>SGST</th></>}
                                <th style={{ whiteSpace:'nowrap' }}>Total Tax</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ textAlign:'right', whiteSpace:'nowrap', padding: '4px 8px' }}>{invoice.subtotal.toFixed(2)}</td>
                                {isInter ? (
                                  <><td>{((invoice.igst_amount/invoice.subtotal)*100 || 0).toFixed(0)}%</td><td style={{ textAlign:'right', whiteSpace:'nowrap', padding: '4px 8px' }}>{invoice.igst_amount.toFixed(2)}</td></>
                                ) : (
                                  <>
                                    <td style={{ textAlign:'center', fontSize: '7pt' }}>{((invoice.cgst_amount/invoice.subtotal)*100 || 0).toFixed(1)}%</td>
                                    <td style={{ textAlign:'right', whiteSpace:'nowrap', padding: '4px 8px' }}>{invoice.cgst_amount.toFixed(2)}</td>
                                    <td style={{ textAlign:'center', fontSize: '7pt' }}>{((invoice.sgst_amount/invoice.subtotal)*100 || 0).toFixed(1)}%</td>
                                    <td style={{ textAlign:'right', whiteSpace:'nowrap', padding: '4px 8px' }}>{invoice.sgst_amount.toFixed(2)}</td>
                                  </>
                                )}
                                <td style={{ textAlign:'right', fontWeight:700, whiteSpace:'nowrap', padding: '4px 8px' }}>{invoice.total_gst.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* One-line math summary for manual matching */}
                        <div className="math-summary-line" style={{ marginTop: 12, paddingTop: 6, borderTop: '1px dashed #ccc', fontSize: '0.75rem', color: '#000' }}>
                           <strong>Calculation:</strong> Subtotal {formatINR(invoice.subtotal)} 
                           {invoice.total_gst > 0 && ` + GST ${formatINR(invoice.total_gst)}`}
                           {(invoice as any).cash_discount > 0 && ` - Disc ${formatINR((invoice as any).cash_discount)}`}
                           {` = `} <strong>{formatINR(invoice.grand_total)}</strong>
                        </div>

                        {profile?.bank_name && (
                          <div style={{ marginTop: 10 }}>
                            <div className="label-xs">Bank Details</div>
                            <div className="text-xs">Bank: {profile.bank_name} | A/c No: {profile.bank_account}</div>
                            <div className="text-xs">Branch & IFSC: {profile.bank_ifsc}</div>
                          </div>
                        )}
                      </div>
                      <div className="invoice-info-box" style={{ textAlign:'right', display:'flex', flexDirection:'column', justifyContent:'space-between', paddingBottom: 0 }}>
                         <div>
                            <div className="text-xs">E. & O.E.</div>
                         </div>
                         <div>
                            <div className="label-xs">for {profile?.business_name}</div>
                            <div style={{ height: 40 }}></div>
                            <div className="label-sm">Authorised Signatory</div>
                         </div>
                      </div>
                    </div>
                  </div>
               </td>
             </tr>
          </tfoot>
        </table>
        
        <div className="no-print" style={{ textAlign:'center', fontSize:'0.7rem', color:'var(--text-muted)', marginTop: 15 }}>
          This is a Computer Generated Invoice
        </div>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print, .sidebar, .bottom-nav, .topbar { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; display: block !important; }
          .page-content { padding: 0 !important; }
          
          @page { size: A4; margin: 10mm; }
          
          .invoice-master-table { width: 100%; border-collapse: collapse; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }

          .invoice-box { border: 1px solid #000; width: 100%; }
          .no-border-bottom { border-bottom: none; }
          .no-border-top { border-top: none; }
          
          .invoice-header-row { text-align: center; border-bottom: 1px solid #000; padding: 4px; }
          .invoice-header-title { font-weight: 900; font-size: 11pt; letter-spacing: 1px; }
          
          .invoice-grid-2 { display: grid; grid-template-columns: 1.2fr 0.8fr; }
          .invoice-info-box { padding: 6px 8px; min-height: 40px; }
          
          .label-sm { font-size: 8pt; font-weight: 700; color: #000; margin-bottom: 2px; }
          .label-xs { font-size: 7pt; font-weight: 700; color: #333; }
          .text-sm { font-size: 9pt; line-height: 1.2; color: #000; }
          .text-xs { font-size: 8pt; line-height: 1.1; color: #000; }
          .business-main-name { font-size: 11pt; font-weight: 900; margin-bottom: 2px; }
          .business-sub-name { font-size: 10pt; font-weight: 800; margin-bottom: 2px; }
          .value-sm { font-size: 9pt; }
          
          .border-right { border-right: 1px solid #000; }
          .border-bottom { border-bottom: 1px solid #000; }
          .border-top { border-top: 1px solid #000; }
          
          .invoice-item-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .invoice-item-table th, .invoice-item-table td { 
            border: 1px solid #000; 
            padding: 4px 6px; 
            font-size: 8pt;
            word-wrap: break-word;
          }
          .invoice-item-table th { background: #eee !important; font-weight: 800; text-transform: uppercase; font-size: 7.5pt; color: #000; }
          .invoice-item-table.body-only td { border-top: none; border-bottom: none; height: auto; }
          .spacer-row td { height: 20px; border-top: none; border-bottom: none; }
          .total-row td { background: #eee !important; border: 1px solid #000 !important; }
          
          .tax-table { width: 100%; border-collapse: collapse; margin-top: 4px; border: 1px solid #000; table-layout: auto; }
          .tax-table th, .tax-table td { border: 1px solid #000; padding: 2px 4px; font-size: 7.5pt; color: #000; min-width: 40px; }
          .tax-table th { background: #eee !important; font-weight: 700; }
        }

        @media screen {
          .invoice-container {
             background: white; padding: 2rem; border-radius: 12px; color: #1e293b; box-shadow: var(--shadow-lg); 
             max-width: 850px; margin: 0 auto; overflow: visible;
          }
          .invoice-master-table { width: 100%; border-collapse: collapse; }
          .invoice-box { border: 1px solid #e2e8f0; border-radius: 4px; }
          .no-border-bottom { border-bottom: none; border-radius: 4px 4px 0 0; }
          .no-border-top { border-top: none; border-radius: 0 0 4px 4px; }
          .invoice-header-row { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: center; }
          .invoice-header-title { font-weight: 800; font-size: 1.2rem; color: var(--brand-primary); }
          .invoice-grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
          .invoice-info-box { padding: 1rem; }
          .border-right { border-right: 1px solid #e2e8f0; }
          .border-bottom { border-bottom: 1px solid #e2e8f0; }
          .border-top { border-top: 1px solid #e2e8f0; }
          .label-sm { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
          .business-main-name { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; }
          
          .invoice-item-table { width:100%; border-collapse: collapse; table-layout: fixed; }
          .invoice-item-table th, .invoice-item-table td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 0.85rem; word-wrap: break-word; }
          .invoice-item-table th { background: #f8fafc; font-weight: 700; color: #334155; font-size: 0.8rem; }
          
          .tax-table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: auto; }
          .tax-table th, .tax-table td { border: 1px solid #e2e8f0; padding: 6px; font-size: 0.8rem; word-wrap: break-word; min-width: 50px; }
          .math-summary-line { background: #f8fafc; border-radius: 6px; padding: 8px 12px !important; }
        }

        /* Mobile specific fixes */
        @media screen and (max-width: 768px) {
          .desktop-only { display: none !important; }
          .invoice-container { display: none !important; }
        }
      `}</style>
    </div>
  )
}
