'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format } from 'date-fns'
import type { Invoice } from '@/lib/types'

export default function SalesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0, gst: 0 })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .eq('invoice_type', 'sale')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    const list = data || []
    setInvoices(list)
    setStats({
      total: list.reduce((s, i) => s + i.grand_total, 0),
      paid: list.filter(i => i.payment_status === 'paid').reduce((s, i) => s + i.grand_total, 0),
      unpaid: list.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + (i.grand_total - i.amount_paid), 0),
      gst: list.reduce((s, i) => s + i.total_gst, 0),
    })
    setLoading(false)
  }

  async function cancelInvoice(id: string) {
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  const filtered = invoices.filter(inv => {
    const matchSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || inv.payment_status === statusFilter
    return matchSearch && matchStatus
  })

  const statusBadge = (s: string) => {
    if (s === 'paid') return <span className="badge badge-paid">Paid</span>
    if (s === 'partial') return <span className="badge badge-partial">Partial</span>
    return <span className="badge badge-unpaid">Unpaid</span>
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sales & Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices</p>
        </div>
        <div className="page-actions">
          <Link href="/sales/new">
            <button className="btn btn-primary" id="new-sale-btn">+ New Invoice</button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'Total Sales', val: formatINR(stats.total), color: '#10b981', icon: '💰' },
          { label: 'Collected', val: formatINR(stats.paid), color: '#6366f1', icon: '✅' },
          { label: 'Outstanding', val: formatINR(stats.unpaid), color: '#f59e0b', icon: '⏳' },
          { label: 'GST Collected', val: formatINR(stats.gst), color: '#06b6d4', icon: '📋' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': s.color } as React.CSSProperties}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">{s.label}</span>
              <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search invoice # or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ minWidth: 260 }}>
          {[['all','All'],['paid','Paid'],['partial','Partial'],['unpaid','Unpaid']].map(([v,l]) => (
            <button key={v} className={`tab ${statusFilter===v?'active':''}`} onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <h3>No invoices found</h3>
          <p>Create your first GST invoice to get started</p>
          <Link href="/sales/new"><button className="btn btn-primary">+ New Invoice</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td data-label="Invoice #">
                    <span className="monospace" style={{ color:'var(--brand-primary-light)', fontWeight:600 }}>{inv.invoice_number}</span>
                  </td>
                  <td data-label="Customer">
                    <div style={{ fontWeight:500 }}>{inv.customer_name || 'Walk-in Customer'}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{inv.supply_type}</div>
                  </td>
                  <td data-label="Date" style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                    {format(new Date(inv.invoice_date), 'dd MMM yyyy')}
                  </td>
                  <td data-label="Amount">
                    <div style={{ fontWeight:700, fontFamily:'var(--font-mono)' }}>{formatINR(inv.grand_total)}</div>
                    {inv.payment_status === 'partial' && (
                      <div style={{ fontSize:'0.75rem', color:'var(--brand-warning)' }}>Paid: {formatINR(inv.amount_paid)}</div>
                    )}
                  </td>
                  <td data-label="GST" style={{ fontFamily:'var(--font-mono)', fontSize:'0.875rem' }}>{formatINR(inv.total_gst)}</td>
                  <td data-label="Status">{statusBadge(inv.payment_status)}</td>
                  <td data-label="Actions">
                    <div style={{ display:'flex', gap:'var(--space-1)' }}>
                      <Link href={`/sales/${inv.id}`}>
                        <button className="btn btn-ghost btn-sm" title="View">👁️</button>
                      </Link>
                      <Link href={`/sales/${inv.id}/print`}>
                        <button className="btn btn-ghost btn-sm" title="Print">🖨️</button>
                      </Link>
                      <button className="btn btn-ghost btn-sm" title="Cancel" onClick={() => { if(confirm('Cancel this invoice?')) cancelInvoice(inv.id) }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
