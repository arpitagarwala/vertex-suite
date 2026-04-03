'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  
  const [data, setData] = useState({
    sales: 0, cgst: 0, sgst: 0, igst: 0,
    b2bCount: 0, b2cCount: 0,
    invoices: [] as any[]
  })

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [yyyy, mm] = month.split('-')
    const start = `${month}-01`
    const end = format(endOfMonth(new Date(parseInt(yyyy), parseInt(mm) - 1)), 'yyyy-MM-dd')

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('user_id', user.id)
      .eq('invoice_type', 'sale')
      .eq('status', 'active')
      .gte('invoice_date', start)
      .lte('invoice_date', end)

    const list = invoices || []
    
    let sgst = 0, cgst = 0, igst = 0, sales = 0, b2bCount = 0, b2cCount = 0
    
    list.forEach(i => {
      sales += i.taxable_amount || 0
      sgst += i.sgst_amount || 0
      cgst += i.cgst_amount || 0
      igst += i.igst_amount || 0
      if (i.customer_gstin) b2bCount++
      else b2cCount++
    })

    setData({ sales, cgst, sgst, igst, b2bCount, b2cCount, invoices: list })
    setLoading(false)
  }

  function exportCSV() {
    const headers = ['Invoice Number', 'Date', 'Customer Name', 'GSTIN', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total Invoice Value']
    const rows = data.invoices.map(i => [
      i.invoice_number, i.invoice_date, i.customer_name, i.customer_gstin || '',
      i.taxable_amount, i.igst_amount, i.cgst_amount, i.sgst_amount, i.grand_total
    ].join(','))
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n")
    downloadFile(`GSTR1_Export_${month}.csv`, csvContent)
  }

  function exportJSON() {
    const b2b: any[] = []
    const b2cs: any[] = []

    data.invoices.forEach(inv => {
      const rates: Record<string, { txval: number, iamt: number, camt: number, samt: number }> = {}
      if (inv.invoice_items) {
        inv.invoice_items.forEach((item: any) => {
          const rt = item.gst_rate.toString()
          if (!rates[rt]) rates[rt] = { txval: 0, iamt: 0, camt: 0, samt: 0 }
          rates[rt].txval += item.taxable_amount || 0
          rates[rt].iamt += item.igst_amount || 0
          rates[rt].camt += item.cgst_amount || 0
          rates[rt].samt += item.sgst_amount || 0
        })
      } else {
         rates['18'] = { txval: inv.taxable_amount, iamt: inv.igst_amount, camt: inv.cgst_amount, samt: inv.sgst_amount }
      }

      if (inv.customer_gstin) {
        b2b.push({
          ctin: inv.customer_gstin,
          inv: [{
            inum: inv.invoice_number,
            idt: format(new Date(inv.invoice_date), 'dd-MM-yyyy'),
            val: inv.grand_total,
            pos: inv.customer_state_code || '27',
            rchrg: "N", inv_typ: "R",
            itms: Object.keys(rates).map((rt, idx) => ({
              num: idx + 1,
              itm_det: {
                txval: rates[rt].txval, rt: parseFloat(rt),
                iamt: rates[rt].iamt, camt: rates[rt].camt, samt: rates[rt].samt
              }
            }))
          }]
        })
      } else {
        Object.keys(rates).forEach(rt => {
           b2cs.push({
             sply_ty: inv.supply_type === 'interstate' ? 'INTER' : 'INTRA',
             txval: rates[rt].txval, typ: 'OE', rt: parseFloat(rt), pos: inv.customer_state_code || '27',
             iamt: rates[rt].iamt, camt: rates[rt].camt, samt: rates[rt].samt
           })
        })
      }
    })

    const payload = {
      gstin: "YOUR_GSTIN", // Note: replace with actual GSTIN from profiles
      fp: month.split('-').reverse().join(''),
      gt: data.sales,
      b2b, b2cs
    }

    const encoded = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2))
    downloadFile(`GSTR1_${month}.json`, encoded)
  }

  function downloadFile(filename: string, content: string) {
    const link = document.createElement("a")
    link.href = content
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Reports & GST</h1>
          <p className="page-subtitle">View and export data for tax filing</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: 200 }}>
            <label className="form-label">Select Month</label>
            <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={loading || data.invoices.length === 0}>
            📄 Export CSV
          </button>
          <button className="btn btn-primary" onClick={exportJSON} disabled={loading || data.invoices.length === 0}>
            📤 Export GSTR-1 JSON
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-4 gap-4">
           {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          {/* Tax Liability */}
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1.1rem' }}>GST Liability summary</h3>
            <div className="grid grid-4 gap-4">
               <div>
                  <div className="stat-label">Total Taxable Sales</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: 4 }}>{formatINR(data.sales)}</div>
               </div>
               <div>
                  <div className="stat-label">CGST Output</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--brand-primary-light)', marginTop: 4 }}>{formatINR(data.cgst)}</div>
               </div>
               <div>
                  <div className="stat-label">SGST Output</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--brand-primary-light)', marginTop: 4 }}>{formatINR(data.sgst)}</div>
               </div>
               <div>
                  <div className="stat-label">IGST Output</div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--brand-primary-light)', marginTop: 4 }}>{formatINR(data.igst)}</div>
               </div>
            </div>
          </div>

          <div className="card">
             <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1.1rem' }}>B2B vs B2C Breakdown</h3>
             <div className="grid grid-2 gap-4">
                <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                   <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{data.b2bCount}</div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2B Invoices (Customers with GSTIN)</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                   <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{data.b2cCount}</div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2C Invoices (Unregistered Consumers)</div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
