'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import type { Customer } from '@/lib/types'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
    setCustomers(data || [])
    setLoading(false)
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered customers</p>
        </div>
        <div className="page-actions">
          <Link href="/customers/add">
            <button className="btn btn-primary">+ Add Customer</button>
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search by name, phone or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No customers found</h3>
          <p>Add your clients to track their sales and GST details.</p>
          <Link href="/customers/add"><button className="btn btn-primary">+ Add Customer</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Contact</th>
                <th>Type / GSTIN</th>
                <th>Location</th>
                <th>Total Purchases</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td data-label="Name">
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                  </td>
                  <td data-label="Contact">
                    <div style={{ fontSize: '0.85rem' }}>{c.phone || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email || ''}</div>
                  </td>
                  <td data-label="Type/GSTIN">
                    <span className={`badge ${c.customer_type === 'b2b' ? 'badge-primary' : 'badge-secondary'}`}>
                      {c.customer_type.toUpperCase()}
                    </span>
                    {c.gstin && <div className="monospace" style={{ fontSize: '0.75rem', marginTop: 4 }}>{c.gstin}</div>}
                  </td>
                  <td data-label="Location">
                    <div style={{ fontSize: '0.85rem' }}>{c.city || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.state_name || ''}</div>
                  </td>
                  <td data-label="Total Purchases">
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatINR(c.total_purchases || 0)}</div>
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
