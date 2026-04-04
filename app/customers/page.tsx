'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { Icons } from '@/components/Icons'
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
    const { data } = await supabase.from('customers').select('*')
      .eq('user_id', user.id).neq('customer_type', 'vendor').order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  async function deleteCustomer(id: string) {
    if (!confirm('Delete this customer?')) return
    await supabase.from('customers').delete().eq('id', id)
    load()
  }

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.gstin?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} clients registered</p>
        </div>
        <div className="page-actions">
          <Link href="/customers/add">
            <button className="btn btn-primary" id="add-customer-btn" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Plus size={15} /> Add Customer
            </button>
          </Link>
        </div>
      </div>

      <div style={{ marginBottom:'var(--space-5)' }}>
        <div className="search-bar" style={{ maxWidth: 440 }}>
          <span className="search-icon"><Icons.Search size={16} /></span>
          <input className="form-input" placeholder="Search by name, phone, email or GSTIN..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft:'2.5rem' }} />
        </div>
      </div>



      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Customers size={28} /></div>
          <h3>No customers found</h3>
          <p>{search ? 'Try a different search term' : 'Add your clients to track sales and GST details.'}</p>
          <Link href="/customers/add"><button className="btn btn-primary"><Icons.Plus size={14} /> Add Customer</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th><th>Contact</th><th>Type / GSTIN</th><th>Location</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td data-label="Name">
                    <div style={{ fontWeight:600 }}>{c.name}</div>
                    {c.address && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{c.address}</div>}
                  </td>
                  <td data-label="Contact">
                    <div style={{ fontSize:'0.875rem' }}>{c.phone || '—'}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{c.email || ''}</div>
                  </td>
                  <td data-label="Type/GSTIN">
                    <span className={`badge ${c.customer_type === 'b2b' ? 'badge-primary' : 'badge-secondary'}`}>
                      {c.customer_type?.toUpperCase() || 'B2C'}
                    </span>
                    {c.gstin && <div className="monospace" style={{ fontSize:'0.72rem', marginTop:4 }}>{c.gstin}</div>}
                  </td>
                  <td data-label="Location">
                    <div style={{ fontSize:'0.875rem' }}>{c.city || '—'}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{c.state_name || ''}</div>
                  </td>
                  <td data-label="Actions">
                    <div style={{ display:'flex', gap:'var(--space-1)' }}>
                      <Link href={`/customers/${c.id}/edit`}>
                        <button className="btn btn-ghost btn-sm" title="Edit"><Icons.Edit size={15} /></button>
                      </Link>
                      <button className="btn btn-ghost btn-sm" title="Delete" style={{ color:'var(--brand-danger)' }}
                        onClick={() => deleteCustomer(c.id)}>
                        <Icons.Trash size={15} />
                      </button>
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
