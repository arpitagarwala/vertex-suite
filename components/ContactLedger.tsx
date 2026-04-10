'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatNumber } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import { format } from 'date-fns'
import type { Customer, Invoice, Profile } from '@/lib/types'
import { generateContactStatementPDF } from '@/lib/pdf'

interface Props {
  id: string
  type: 'customer' | 'supplier'
}

export default function ContactLedger({ id, type }: Props) {
  const supabase = createClient()
  const [contact, setContact] = useState<Customer | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [contactRes, invoicesRes, profileRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('status', 'active').order('invoice_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single()
    ])

    setContact(contactRes.data)
    setInvoices(invoicesRes.data || [])
    setProfile(profileRes.data)
    setLoading(false)
  }

  const filtered = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const stats = invoices.reduce((acc, inv) => {
    const isSale = inv.invoice_type === 'sale'
    const amt = Number(inv.grand_total) || 0
    const paid = Number(inv.amount_paid) || 0
    const due = amt - paid

    if (isSale) {
      acc.billed += amt
      acc.received += paid
      acc.due += due
    } else {
      acc.purchased += amt
      acc.paidToVendor += paid
      acc.dueToVendor += due
    }
    return acc
  }, { billed: 0, received: 0, due: 0, purchased: 0, paidToVendor: 0, dueToVendor: 0 })

  const netBalance = (stats.due - stats.dueToVendor)

  async function handleDownloadStatement() {
    if (!contact || !invoices.length || !profile) return
    setDownloading(true)
    try {
      await generateContactStatementPDF({ contact, invoices, profile })
    } catch (err) {
      console.error(err)
      alert('Failed to generate statement')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-fade">
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
        <div className="grid grid-3 gap-4 mb-6">
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 100 }} />
          <div className="skeleton" style={{ height: 100 }} />
        </div>
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="empty-state">
        <Icons.AlertTriangle size={48} color="var(--brand-danger)" />
        <h3>Contact Not Found</h3>
        <p>The {type} you are looking for does not exist or has been removed.</p>
        <Link href={type === 'customer' ? '/customers' : '/suppliers'}>
          <button className="btn btn-primary">Back to List</button>
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade">
      {/* Breadcrumb & Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
             <Link href={type === 'customer' ? '/customers' : '/suppliers'} className="text-link" style={{ fontSize: '0.875rem' }}>
                {type === 'customer' ? 'Customers' : 'Suppliers'}
             </Link>
             <Icons.ChevronRight size={14} color="var(--text-muted)" />
             <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Ledger</span>
          </div>
          <h1 className="page-title">{contact.name}</h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            {contact.gstin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--brand-primary-light)' }}>
                <Icons.Shield size={14} /> <span className="monospace">{contact.gstin}</span>
              </div>
            )}
            {contact.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Icons.Zap size={14} /> <span>{contact.phone}</span>
              </div>
            )}
          </div>
        </div>
        <div className="page-actions">
           <button className="btn btn-secondary" onClick={handleDownloadStatement} disabled={downloading}>
              <Icons.Download size={15} /> {downloading ? 'Generating...' : 'Download Statement'}
           </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ '--accent-color': 'var(--brand-primary)' } as any}>
          <div className="stat-label">Total Billed</div>
          <div className="stat-value">{formatINR(type === 'customer' ? stats.billed : stats.purchased)}</div>
          <div className="stat-subtext" style={{ color: 'var(--text-muted)' }}>
            {invoices.length} transactions
          </div>
        </div>
        
        <div className="stat-card" style={{ '--accent-color': 'var(--brand-success)' } as any}>
          <div className="stat-label">Total Paid</div>
          <div className="stat-value">{formatINR(type === 'customer' ? stats.received : stats.paidToVendor)}</div>
          <div className="stat-subtext" style={{ color: 'var(--brand-success)' }}>
             Completed payments
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': netBalance >= 0 ? 'var(--brand-danger)' : 'var(--brand-success)' } as any}>
          <div className="stat-label">{netBalance >= 0 ? 'Outstanding Balance' : 'Advance Balance'}</div>
          <div className="stat-value">{formatINR(Math.abs(netBalance))}</div>
          <div className="stat-subtext" style={{ color: netBalance >= 0 ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
            {netBalance >= 0 ? 'Receivable from them' : 'Payable to them'}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="table-wrap" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Transaction History</h3>
          <div className="search-bar" style={{ maxWidth: 300 }}>
            <Icons.Search size={16} className="search-icon" />
            <input 
              className="form-input" 
              placeholder="Filter by invoice #..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
             No transactions found matching your criteria.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amt (Incl. Tax)</th>
                <th style={{ textAlign: 'right' }}>Net Outstanding</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Calculate running balance chronologically
                const chronological = [...filtered].sort((a,b) => 
                  new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
                )
                let currentBal = 0
                const balanceMap = new Map()
                chronological.forEach(inv => {
                  const net = inv.invoice_type === 'sale' 
                    ? (inv.grand_total - (inv.amount_paid || 0))
                    : -(inv.grand_total - (inv.amount_paid || 0))
                  currentBal += net
                  balanceMap.set(inv.id, currentBal)
                })

                return filtered.map(inv => {
                  const netOutstanding = inv.invoice_type === 'sale'
                    ? (inv.grand_total - (inv.amount_paid || 0))
                    : -(inv.grand_total - (inv.amount_paid || 0))

                  return (
                    <tr key={inv.id}>
                      <td>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                      </td>
                      <td>
                        <span className={`badge ${inv.invoice_type === 'sale' ? 'badge-primary' : 'badge-secondary'}`}>
                          {inv.invoice_type?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatINR(inv.grand_total)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: netOutstanding > 0 ? 'var(--brand-danger)' : netOutstanding < 0 ? 'var(--brand-success)' : 'inherit' }}>
                        {formatINR(Math.abs(netOutstanding))}
                        {netOutstanding !== 0 && (
                          <span style={{ fontSize: '0.65rem', marginLeft: 4 }}>
                            {netOutstanding > 0 ? 'DR' : 'CR'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatINR(Math.abs(balanceMap.get(inv.id)))}
                        <span style={{ fontSize: '0.65rem', marginLeft: 4 }}>
                          {balanceMap.get(inv.id) >= 0 ? 'DR' : 'CR'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/${inv.invoice_type === 'sale' ? 'sales' : 'purchases'}/${inv.id}`}>
                          <button className="btn btn-ghost btn-sm" title="View"><Icons.Eye size={15} /></button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
