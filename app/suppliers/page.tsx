'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons } from '@/components/Icons'

export default function SuppliersPage() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('customers').select('*')
      .eq('user_id', user.id).eq('customer_type', 'vendor').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  async function deleteSupplier(id: string) {
    if (!confirm('Delete this supplier?')) return
    await supabase.from('customers').delete().eq('id', id)
    load()
  }

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.gstin?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  )

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{suppliers.length} vendors registered</p>
        </div>
        <div className="page-actions">
          <Link href="/suppliers/add">
            <button className="btn btn-primary" id="add-supplier-btn" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Plus size={15} /> Add Supplier
            </button>
          </Link>
        </div>
      </div>

      <div style={{ marginBottom:'var(--space-5)' }}>
        <div className="search-bar">
          <span className="search-icon"><Icons.Search size={16} /></span>
          <input className="form-input" placeholder="Search by name, GSTIN, or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:'2.5rem' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
          {[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{ height:70 }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Suppliers size={28} /></div>
          <h3>No suppliers found</h3>
          <p>Add the vendors you procure goods from to manage purchases efficiently</p>
          <Link href="/suppliers/add"><button className="btn btn-primary">+ Add Supplier</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>GSTIN</th>
                <th>Phone</th>
                <th>City / State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td data-label="Name">
                    <div style={{ fontWeight:600 }}>{s.name}</div>
                    {s.email && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{s.email}</div>}
                  </td>
                  <td data-label="GSTIN">
                    <span className="monospace" style={{ fontSize:'0.8rem', color:'var(--brand-primary-light)' }}>{s.gstin || '—'}</span>
                  </td>
                  <td data-label="Phone" style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>{s.phone || '—'}</td>
                  <td data-label="Location" style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>{[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
                  <td data-label="Actions">
                    <div style={{ display:'flex', gap:'var(--space-1)' }}>
                      <Link href={`/suppliers/${s.id}/edit`}>
                        <button className="btn btn-ghost btn-sm" title="Edit"><Icons.Edit size={15} /></button>
                      </Link>
                      <button className="btn btn-ghost btn-sm" title="Delete" style={{ color:'var(--brand-danger)' }} onClick={() => deleteSupplier(s.id)}>
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
