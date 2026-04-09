'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR, numberToWords, formatNumber, getStateName } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import { format } from 'date-fns'
import { generateInvoicePDF } from '@/lib/pdf'
import type { Invoice, InvoiceItem, Profile } from '@/lib/types'
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/types'

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  // Merge settings with defaults
  const settings = profile?.invoice_settings || DEFAULT_INVOICE_SETTINGS
  const branding = settings.branding || DEFAULT_INVOICE_SETTINGS.branding
  const layout = settings.layout || DEFAULT_INVOICE_SETTINGS.layout

  useEffect(() => { 
    load() 
  }, [id])

  useEffect(() => {
    if (!loading && invoice && profile && searchParams.get('download') === 'true') {
      const url = new URL(window.location.href)
      url.searchParams.delete('download')
      window.history.replaceState({}, '', url.toString())
      handleDownloadPDF()
    }
  }, [loading, invoice, profile, searchParams])

  async function handleDownloadPDF() {
    if (!invoice || !profile) return
    setDownloading(true)
    try {
      await generateInvoicePDF({ invoice, items, profile, titleOverride: 'PURCHASE BILL' })
    } catch (e) {
      console.error('PDF generation failed:', e)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

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
    if (!invoice) return
    await supabase.from('invoices').update({ payment_status: 'paid', amount_paid: invoice.grand_total }).eq('id', id)
    setInvoice(i => i ? { ...i, payment_status: 'paid', amount_paid: i.grand_total } : i)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}><div className="skeleton" style={{ width:'100%', height:400 }} /></div>
  if (!invoice) return <div className="empty-state"><h3>Purchase record not found</h3></div>

  const isInter = invoice.supply_type === 'interstate'

  return (
    <div className="animate-fade">
      <div className="page-header no-print">
        <div className="page-header-left">
          <h1 className="page-title">Purchase Bill: {invoice.invoice_number}</h1>
          <p className="page-subtitle">{format(new Date(invoice.invoice_date), 'dd MMMM yyyy')}</p>
        </div>
        <div className="page-actions">
          {invoice.payment_status !== 'paid' && (
            <button className="btn btn-success" onClick={markPaid} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Check size={15} /> Mark Paid
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => router.push(`/purchases/${id}/edit`)} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Edit size={15} /> Edit Bill
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={downloading} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.Download size={15} /> {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/settings')} title="Invoice Settings" style={{ padding:'8px', minWidth:'auto' }}>
            <Icons.Settings size={16} />
          </button>
        </div>
      </div>

      {/* Status Row */}
      <div className="no-print" style={{ marginBottom:'var(--space-4)', display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'center' }}>
        {invoice.payment_status === 'paid' && <span className="badge badge-paid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>Fully Paid</span>}
        {invoice.payment_status === 'partial' && <span className="badge badge-partial" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>Partial — {formatINR(invoice.amount_paid)} paid</span>}
        {invoice.payment_status === 'unpaid' && <span className="badge badge-unpaid" style={{ fontSize:'0.85rem', padding:'6px 12px' }}>{formatINR(invoice.grand_total)} outstanding</span>}
        <span className="badge badge-secondary" style={{ fontSize:'0.85rem', padding:'6px 12px', textTransform:'capitalize' }}>{invoice.supply_type}</span>
      </div>



      {/* Professional Purchase Bill View */}
      <div className="invoice-container" id="invoice-print">
        <table className="invoice-master-table">
          <thead>
            <tr>
              <td>
                <div className="invoice-box no-border-bottom">
                  <div className="invoice-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: branding.showLogo && profile?.logo_url ? 80 : 'auto' }}>
                    {branding.showLogo && profile?.logo_url && (
                      <div className="invoice-logo-wrap" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <img src={profile.logo_url} alt="Logo" className="invoice-logo" />
                      </div>
                    )}
                    <div className="invoice-header-title">{branding.title || 'PURCHASE BILL / INWARD INVOICE'}</div>
                    {branding.subtitle && <div className="invoice-header-subtitle" style={{ position: 'absolute', right: 10, fontSize: '0.7rem', color: '#64748b' }}>{branding.subtitle}</div>}
                  </div>

                  <div className="invoice-grid-2">
                    <div className="invoice-info-box border-right">
                      <div className="label-sm">Consignor (Vendor/Supplier)</div>
                      <div className="business-main-name">{invoice.customer_name || 'Walk-in Vendor'}</div>
                      <div className="text-sm">GSTIN/UIN: <strong>{invoice.customer_gstin || 'N/A'}</strong></div>
                      <div className="text-sm">State Name: {getStateName(invoice.customer_state_code || (invoice.supply_type === 'intrastate' ? profile?.state_code : null))}</div>
                      <div className="text-sm">Code: {invoice.customer_state_code || (invoice.supply_type === 'intrastate' ? profile?.state_code : 'N/A')}</div>
                    </div>
                    <div className="invoice-info-box">
                      <div className="grid-details">
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Bill/Invoice No.</div>
                          <div className="value-sm"><strong>{invoice.invoice_number}</strong></div>
                        </div>
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Dated</div>
                          <div className="value-sm"><strong>{format(new Date(invoice.invoice_date), 'dd-MMM-yyyy')}</strong></div>
                        </div>
                        <div className="detail-item border-bottom">
                          <div className="label-xs">Place of Supply</div>
                          <div className="value-sm" style={{ textTransform:'capitalize' }}>
                            {getStateName(invoice.customer_state_code || (invoice.supply_type === 'intrastate' ? profile?.state_code : null))} ({invoice.customer_state_code || (invoice.supply_type === 'intrastate' ? profile?.state_code : '')})
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="invoice-info-box border-top border-bottom">
                    <div className="label-sm">Consignee (Buyer - Our Business)</div>
                    <div className="business-sub-name">{profile?.business_name}</div>
                    <div className="text-sm">{profile?.address}</div>
                    <div className="text-sm">{profile?.city}, {profile?.state_name} - {profile?.pincode}</div>
                    <div className="text-sm">GSTIN: <strong>{profile?.gstin}</strong></div>
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
                      <th style={{ width: '8%', whiteSpace: 'nowrap', textAlign: 'center' }}>S.No.</th>
                      <th style={{ width: '37%', textAlign: 'left' }}>Description of Goods</th>
                      <th style={{ width: '12%', whiteSpace: 'nowrap', textAlign: 'center' }}>HSN/SAC</th>
                      <th style={{ width: '8%', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Rate</th>
                      <th style={{ width: '8%', whiteSpace: 'nowrap', textAlign: 'center' }}>per</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                   <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ textAlign:'center' }}>{idx+1}</td>
                          <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ textAlign:'center' }}>{item.hsn_code||''}</td>
                          <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{item.quantity} {item.unit}</td>
                          <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{formatNumber(item.unit_price)}</td>
                          <td style={{ textAlign:'center' }}>{item.unit}</td>
                          <td style={{ textAlign:'right', fontWeight: 600, whiteSpace:'nowrap' }}>{formatNumber(item.total_amount)}</td>
                        </tr>
                      ))}
                      {/* Spacer rows with individual TDs to maintain grid lines */}
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
                    {/* Item Total Row and Adjustments */}
                    <table className="invoice-item-table totals-list">
                      <tfoot>
                        <tr className="subtotal-row" style={{ fontSize: '9pt' }}>
                          <td style={{ width: '85%', textAlign:'right', fontWeight: 600 }}>Total Taxable Value</td>
                          <td style={{ width: '15%', textAlign:'right', fontWeight: 600 }}>{formatNumber(items.reduce((s, i) => s + i.taxable_amount, 0))}</td>
                        </tr>
                        <tr className="tax-row" style={{ fontSize: '9pt' }}>
                          <td style={{ width: '85%', textAlign:'right', fontWeight: 600 }}>Total GST Amount</td>
                          <td style={{ width: '15%', textAlign:'right', fontWeight: 600 }}>{formatNumber(invoice.total_gst)}</td>
                        </tr>
                        {(invoice.cash_discount || 0) > 0 && (
                          <tr className="discount-row" style={{ fontSize: '9pt', color: 'red' }}>
                            <td style={{ width: '85%', textAlign:'right', fontWeight: 600 }}>Less: Cash Discount</td>
                            <td style={{ width: '15%', textAlign:'right', fontWeight: 600 }}>(-) {formatNumber(invoice.cash_discount || 0)}</td>
                          </tr>
                        )}
                        <tr className="total-row">
                          <td style={{ width: '85%', textAlign:'right', fontWeight:800, fontSize: '10pt' }}>Total Payable (Grand Total)</td>
                          <td style={{ width: '15%', textAlign:'right', fontWeight:800, fontSize: '10pt', whiteSpace:'nowrap' }}>{formatINR(invoice.grand_total)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Math Summary & Tax Breakdown */}
                    <div className="invoice-grid-2 border-top">
                      <div className="invoice-info-box border-right">
                        <div className="label-sm">Total in Words</div>
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
                           <strong>Calculation:</strong> Items Total (Tax Incl.) {formatINR(items.reduce((s, i) => s + i.total_amount, 0))} 
                           {(invoice.cash_discount || 0) > 0 && ` - Cash Discount ${formatINR(invoice.cash_discount || 0)}`}
                           {` = `} <strong>{formatINR(invoice.grand_total)}</strong>
                        </div>
                      </div>
                      <div className="invoice-info-box" style={{ textAlign:'right', display:'flex', flexDirection:'column', justifyContent:'space-between', paddingBottom: 0 }}>
                         <div style={{ marginTop: 20 }}>
                            <div className="label-xs">Receiver's Signature</div>
                            <div className="signature-space" style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20 }}>
                               {branding.showSignature && branding.showDigitalSignature && profile?.signature_url && (
                                 <img src={profile.signature_url} alt="Signature" className="invoice-signature" />
                               )}
                            </div>
                            <div className="label-sm">Authorised Signatory</div>
                         </div>
                         <div className="text-xs" style={{ marginTop: 10 }}>E. & O.E.</div>
                      </div>
                    </div>
                  </div>
               </td>
             </tr>
          </tfoot>
        </table>
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

          .invoice-logo { max-height: 50pt; max-width: 150pt; object-fit: contain; }
          .invoice-signature { max-height: 35pt; max-width: 100pt; object-fit: contain; }
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
          .invoice-info-box { padding: 1rem; color: #1e293b; }
          .border-right { border-right: 1px solid #e2e8f0; }
          .border-bottom { border-bottom: 1px solid #e2e8f0; }
          .border-top { border-top: 1px solid #e2e8f0; }
          .label-sm { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .label-xs { font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .value-sm { font-size: 0.85rem; color: #1e293b; font-weight: 600; }
          .business-main-name { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; color: #1e293b; }
          .business-sub-name { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
          .text-sm { font-size: 0.8rem; color: #334155; margin-bottom: 2px; }
          
          .invoice-item-table { width:100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #1e293b; color: #1e293b; }
          .invoice-item-table th, .invoice-item-table td { border: 1px solid #94a3b8; padding: 8px 10px; font-size: 0.85rem; word-wrap: break-word; color: #1e293b; }
          .invoice-item-table th { background: #f1f5f9; font-weight: 800; color: #0f172a; font-size: 0.8rem; text-transform: uppercase; border-bottom: 2px solid #1e293b; }
          
          .tax-table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: auto; }
          .tax-table th, .tax-table td { border: 1px solid #e2e8f0; padding: 6px; font-size: 0.8rem; word-wrap: break-word; min-width: 50px; }
          .math-summary-line { background: #f8fafc; border-radius: 6px; padding: 8px 12px !important; }

          .invoice-logo { max-height: 60px; max-width: 200px; object-fit: contain; }
          .invoice-signature { max-height: 45px; max-width: 150px; object-fit: contain; border-bottom: 1px solid #eee; }
        }

        /* Mobile specific fixes */
        @media screen and (max-width: 768px) {
          .invoice-container:not(#invoice-print) { display: none !important; }
          #invoice-print { 
            display: block !important; 
            position: absolute; 
            left: -9999px; 
            top: -9999px;
          }
        }
        
        @media print {
           #invoice-print {
             display: block !important;
             position: static !important;
             left: auto !important;
             top: auto !important;
             width: 100% !important;
           }
        }
      `}</style>
    </div>
  )
}
