'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format } from 'date-fns'
import type { Invoice } from '@/lib/types'

export default function PurchasesPage() {
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
      .eq('invoice_type', 'purchase')
      .eq('status', 'active')
      .order('invoice_date', { ascending: false })
      
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
    if (!confirm('Cancel this purchase? Stock will need to be manually adjusted if already logged.')) return
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  async function markPaid(id: string, total: number) {
     if (!confirm('Mark as fully paid?')) return
     await supabase.from('invoices').update({ payment_status: 'paid', amount_paid: total }).eq('id', id)
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
    return <span className="badge badge-unpaid">Pending</span>
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Purchases & Inwards</h1>
          <p className="page-subtitle">{invoices.length} vendor bills logged (ITC Tracker)</p>
        </div>
        <div className="page-actions">
          <Link href="/purchases/new">
            <button className="btn btn-primary" id="new-purchase-btn">+ Log Purchase Bill</button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'Total Purchases', val: formatINR(stats.total), color: '#3b82f6', icon: '🛒' },
          { label: 'Paid to Vendors', val: formatINR(stats.paid), color: '#10b981', icon: '💳' },
          { label: 'Outstanding Dues', val: formatINR(stats.unpaid), color: '#ef4444', icon: '⏳' },
          { label: 'ITC Eligible (GST)', val: formatINR(stats.gst), color: '#8b5cf6', icon: '📋' },
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
          <input className="form-input" placeholder="Search bill # or supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ minWidth: 260 }}>
          {[['all','All'],['paid','Paid'],['unpaid','Pending']].map(([v,l]) => (
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
          <div className="empty-state-icon">🏢</div>
          <h3>No purchase bills found</h3>
          <p>Log your first vendor inward bill to update stock</p>
          <Link href="/purchases/new"><button className="btn btn-primary">+ Log Purchase</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Supplier/Vendor</th>
                <th>Date</th>
                <th>Amount</th>
                <th>GST (ITC)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td data-label="Bill #">
                    <span className="monospace" style={{ color:'var(--brand-primary-light)', fontWeight:600 }}>{inv.invoice_number}</span>
                  </td>
                  <td data-label="Supplier">
                    <div style={{ fontWeight:500 }}>{inv.customer_name || 'Walk-in Vendor'}</div>
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
                  <td data-label="GST (ITC)" style={{ fontFamily:'var(--font-mono)', fontSize:'0.875rem', color:'var(--brand-primary-light)' }}>
                    +{formatINR(inv.total_gst)}
                  </td>
                  <td data-label="Status">{statusBadge(inv.payment_status)}</td>
                  <td data-label="Actions">
                    <div style={{ display:'flex', gap:'var(--space-1)' }}>
                      {inv.payment_status !== 'paid' && <button className="btn btn-ghost btn-sm" title="Mark Paid" onClick={() => markPaid(inv.id, inv.grand_total)}>✅</button>}
                      <button className="btn btn-ghost btn-sm" title="Cancel" onClick={() => cancelInvoice(inv.id)}>✕</button>
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
