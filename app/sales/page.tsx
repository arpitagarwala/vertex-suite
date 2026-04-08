'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format } from 'date-fns'
import { Icons } from '@/components/Icons'
import type { Invoice } from '@/lib/types'

export default function SalesPageWrapper() {
  return <Suspense><SalesPageContent /></Suspense>
}

function SalesPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0, gst: 0 })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('invoices').select('*')
      .eq('user_id', user.id).eq('invoice_type', 'sale').eq('status', 'active')
      .order('invoice_date', { ascending: false })
    const list = data || []
    setInvoices(list)
    setStats({
      total: list.reduce((s, i) => s + i.grand_total, 0),
      paid: list.reduce((s, i) => s + (i.amount_paid || 0), 0),
      unpaid: list.reduce((s, i) => s + Math.max(0, i.grand_total - (i.amount_paid || 0)), 0),
      gst: list.reduce((s, i) => s + i.total_gst, 0),
    })
    setLoading(false)
  }

  async function cancelInvoice(id: string) {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.customer_gstin?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || 
      (statusFilter === 'pending' ? (inv.payment_status === 'unpaid' || inv.payment_status === 'partial') : inv.payment_status === statusFilter)
    const invDate = inv.invoice_date?.slice(0, 10)
    const matchFrom = !dateFrom || invDate >= dateFrom
    const matchTo = !dateTo || invDate <= dateTo
    return matchSearch && matchStatus && matchFrom && matchTo
  })

  const statusBadge = (s: string) => {
    if (s === 'paid') return <span className="badge badge-paid">Paid</span>
    if (s === 'partial') return <span className="badge badge-partial">Partial</span>
    return <span className="badge badge-unpaid">Unpaid</span>
  }

  const STAT_CARDS = [
    { label: 'Total Sales', val: formatINR(stats.total), color: '#10b981', icon: 'TrendUp' as const },
    { label: 'Collected', val: formatINR(stats.paid), color: '#6366f1', icon: 'Check' as const },
    { label: 'Outstanding', val: formatINR(stats.unpaid), color: '#f59e0b', icon: 'AlertTriangle' as const },
    { label: 'GST Collected', val: formatINR(stats.gst), color: '#06b6d4', icon: 'FileText' as const },
  ]

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sales & Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices · {filtered.length} shown</p>
        </div>
        <div className="page-actions">
          <Link href="/sales/new">
            <button className="btn btn-primary" id="new-sale-btn" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Plus size={15} /> New Invoice
            </button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: 'var(--space-5)' }}>
        {STAT_CARDS.map((s, i) => {
          const IconComp = Icons[s.icon]
          return (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as React.CSSProperties}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className="stat-label">{s.label}</span>
                <div className="stat-icon" style={{ background:`${s.color}1a` }}><IconComp size={16} color={s.color} /></div>
              </div>
              <div className="stat-value" style={{ fontSize:'1.25rem' }}>{s.val}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'var(--space-3)', marginBottom:'var(--space-5)', flexWrap:'wrap', alignItems:'center' }}>
        <div className="search-bar" style={{ flex:'1 1 220px' }}>
          <span className="search-icon"><Icons.Search size={16} /></span>
          <input className="form-input" placeholder="Search invoice #, customer, GSTIN..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft:'2.5rem' }} />
        </div>
        <input type="date" className="form-input" style={{ flex:'0 0 150px' }} value={dateFrom}
          onChange={e => setDateFrom(e.target.value)} title="From date" />
        <input type="date" className="form-input" style={{ flex:'0 0 150px' }} value={dateTo}
          onChange={e => setDateTo(e.target.value)} title="To date" />
        <div className="tabs" style={{ display: 'flex', width: '100%', background: 'var(--bg-elevated)', padding: 'var(--space-1)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
          {[['all','All'],['paid','Paid'],['pending','Pending'],['partial','Partial'],['unpaid','Unpaid']].map(([v,l]) => (
            <button key={v} className={`tab ${statusFilter===v?'active':''}`} style={{ flex: 1, textAlign: 'center', padding: 'var(--space-2) 12px', whiteSpace: 'nowrap' }} onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
        {(search || dateFrom || dateTo || statusFilter !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('all') }}>
            <Icons.X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Sales size={28} /></div>
          <h3>No invoices found</h3>
          <p>{search ? 'Try a different search term or clear filters' : 'Create your first GST invoice to get started'}</p>
          <Link href="/sales/new"><button className="btn btn-primary"><Icons.Plus size={14} /> New Invoice</button></Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Customer</th><th>Date</th>
                  <th>Amount</th><th>GST</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <span className="monospace" style={{ color:'var(--brand-primary-light)', fontWeight:600 }}>{inv.invoice_number}</span>
                      {(inv as any).edit_count > 0 && <span className="badge badge-warning" style={{ marginLeft:4, fontSize:'0.65rem' }}>Edited</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight:500 }}>{inv.customer_name || 'Walk-in'}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{inv.supply_type}</div>
                    </td>
                    <td style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                      {format(new Date(inv.invoice_date), 'dd MMM yyyy')}
                    </td>
                    <td>
                      <div style={{ fontWeight:700, fontFamily:'var(--font-mono)' }}>{formatINR(inv.grand_total)}</div>
                      {inv.payment_status === 'partial' && (
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:2, marginTop:4 }}>
                          <div>Paid: <span style={{ color:'var(--brand-success)' }}>{formatINR(inv.amount_paid)}</span></div>
                          <div>Due: <span style={{ color:'var(--brand-warning)', fontWeight:600 }}>{formatINR(inv.grand_total - inv.amount_paid)}</span></div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.875rem' }}>{formatINR(inv.total_gst)}</td>
                    <td>{statusBadge(inv.payment_status)}</td>
                    <td>
                      <div style={{ display:'flex', gap:'var(--space-1)' }}>
                        <Link href={`/sales/${inv.id}`}>
                          <button className="btn btn-ghost btn-sm" title="View"><Icons.Eye size={15} /></button>
                        </Link>
                        <Link href={`/sales/${inv.id}/edit`}>
                          <button className="btn btn-ghost btn-sm" title="Edit"><Icons.Edit size={15} /></button>
                        </Link>
                        <button className="btn btn-ghost btn-sm" title="Cancel" style={{ color:'var(--brand-danger)' }}
                          onClick={() => cancelInvoice(inv.id)}>
                          <Icons.X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion */}
          <div className="accordion-list mobile-only">
            {filtered.map(inv => (
              <div key={inv.id} className={`accordion-item ${expandedId === inv.id ? 'expanded' : ''}`}>
                <div className="accordion-header" onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}>
                  <div className="accordion-summary-left">
                    <span className="accordion-customer">{inv.customer_name || 'Walk-in'}</span>
                    <span className="accordion-date">{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="accordion-summary-right">
                    <span className="accordion-amount">{formatINR(inv.grand_total)}</span>
                    <Icons.ChevronDown size={16} color="var(--text-muted)" style={{ transform: expandedId === inv.id ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </div>
                </div>
                <div className="accordion-body">
                  <div className="accordion-details-grid">
                    <div className="accordion-detail-item">
                      <span className="accordion-detail-label">Invoice #</span>
                      <span className="monospace" style={{ fontSize: '0.8rem', color: 'var(--brand-primary-light)' }}>{inv.invoice_number}</span>
                    </div>
                    <div className="accordion-detail-item">
                      <span className="accordion-detail-label">Status</span>
                      <span>{statusBadge(inv.payment_status)}</span>
                    </div>
                    <div className="accordion-detail-item">
                      <span className="accordion-detail-label">GST</span>
                      <span className="monospace">{formatINR(inv.total_gst)}</span>
                    </div>
                    <div className="accordion-detail-item">
                      <span className="accordion-detail-label">Type</span>
                      <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{inv.supply_type}</span>
                    </div>
                  </div>
                  <div className="accordion-actions">
                    <Link href={`/sales/${inv.id}`} className="flex-1">
                      <button className="btn btn-secondary btn-sm btn-full"><Icons.Eye size={14} /> View</button>
                    </Link>
                    <Link href={`/sales/${inv.id}/edit`} className="flex-1">
                      <button className="btn btn-secondary btn-sm btn-full"><Icons.Edit size={14} /> Edit</button>
                    </Link>
                    <button className="btn btn-danger btn-sm flex-1" onClick={(e) => { e.stopPropagation(); cancelInvoice(inv.id); }}>
                      <Icons.X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
