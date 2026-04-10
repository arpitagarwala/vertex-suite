'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatNumber } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import { format } from 'date-fns'
import type { Customer, Invoice, Profile } from '@/lib/types'
import { generateContactStatementPDF } from '@/lib/pdf'
import PaymentModal from './PaymentModal'
import type { Payment } from '@/lib/types'

interface Props {
  id: string
  type: 'customer' | 'supplier'
}

export default function ContactLedger({ id, type }: Props) {
  const supabase = createClient()
  const [contact, setContact] = useState<Customer | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [contactRes, invoicesRes, paymentsRes, profileRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('status', 'active').order('invoice_date', { ascending: false }),
      supabase.from('payments').select('*').eq('customer_id', id).order('payment_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).single()
    ])

    setContact(contactRes.data)
    setInvoices(invoicesRes.data || [])
    setPayments(paymentsRes.data || [])
    setProfile(profileRes.data)
    setLoading(false)
  }

  const filtered = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    billed: invoices.filter(i => i.invoice_type === 'sale').reduce((s, i) => s + Number(i.grand_total), 0),
    collected: payments.filter(p => p.payment_type === 'received').reduce((s, p) => s + Number(p.amount), 0),
    purchased: invoices.filter(i => i.invoice_type === 'purchase').reduce((s, i) => s + Number(i.grand_total), 0),
    paidOut: payments.filter(p => p.payment_type === 'sent').reduce((s, p) => s + Number(p.amount), 0),
  }

  const netBalance = type === 'customer' 
    ? (stats.billed - stats.collected) 
    : (stats.paidOut - stats.purchased)

  async function handleDownloadStatement() {
    if (!contact || (!invoices.length && !payments.length) || !profile) return
    setDownloading(true)
    try {
      await generateContactStatementPDF({ contact, invoices, payments, profile })
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
        <div className="page-actions" style={{ display: 'flex', gap: 12 }}>
           <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
              <Icons.Plus size={15} /> Record {type === 'customer' ? 'Receipt' : 'Payment'}
           </button>
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
          <div className="stat-label">Total {type === 'customer' ? 'Received' : 'Paid'}</div>
          <div className="stat-value">{formatINR(type === 'customer' ? stats.collected : stats.paidOut)}</div>
          <div className="stat-subtext" style={{ color: 'var(--brand-success)' }}>
             From {payments.length} payments
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': netBalance > 0 ? 'var(--brand-success)' : netBalance < 0 ? 'var(--brand-danger)' : 'inherit' } as any}>
          <div className="stat-label">{netBalance > 0 ? 'Money to Receive' : netBalance < 0 ? 'Advance Balance' : 'Clear Balance'}</div>
          <div className="stat-value">{formatINR(Math.abs(netBalance))}</div>
          <div className="stat-subtext" style={{ color: netBalance > 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
            {netBalance > 0 ? 'Receivable (Asset)' : netBalance < 0 ? 'Payable (Liability)' : 'Balanced'}
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
                <th>Reference #</th>
                <th>Type</th>
                <th>Due Date / Info</th>
                <th style={{ textAlign: 'right' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Merge and calculate running balance (backend only for net check, not displayed)
                const transactions = [
                  ...invoices.map(i => ({ type: 'invoice', date: i.invoice_date, ref: i.invoice_number, amount: Number(i.grand_total), data: i })),
                  ...payments.map(p => ({ type: 'payment', date: p.payment_date, ref: p.reference_no || 'Receipt', amount: Number(p.amount), data: p }))
                ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                return transactions.map((t, idx) => {
                  const isInv = t.type === 'invoice'
                  const isSale = isInv && (t.data as Invoice).invoice_type === 'sale'
                  const isPurchase = isInv && (t.data as Invoice).invoice_type === 'purchase'
                  const isReceipt = t.type === 'payment' && (t.data as Payment).payment_type === 'received'
                  const isPaymentOut = t.type === 'payment' && (t.data as Payment).payment_type === 'sent'

                  // NEW COLOR LOGIC REQUESTED BY USER:
                  // "Since we receive that amount, so make it green" -> Sales/Receipts (Green)
                  // "If we have to pay that amount, make it red" -> Purchases/Payments (Red)
                  const isGreen = isSale || isReceipt
                  const isRed = isPurchase || isPaymentOut

                  return (
                    <tr key={idx}>
                      <td>{format(new Date(t.date), 'dd MMM yyyy')}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.ref}</div>
                        {t.type === 'payment' && (t.data as Payment).notes && <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{(t.data as Payment).notes}</div>}
                      </td>
                      <td>
                        <span className={`badge ${isGreen ? 'badge-success' : 'badge-danger'}`} style={{ color: '#fff' }}>
                          {t.type === 'invoice' ? (t.data as Invoice).invoice_type?.toUpperCase() : 'PAYMENT'}
                        </span>
                      </td>
                      <td>
                         {isInv ? format(new Date((t.data as Invoice).due_date || t.date), 'dd/MM/yyyy') : (t.data as Payment).payment_method?.toUpperCase()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize:'0.8rem' }}>
                         {t.type === 'invoice' ? (t.data as Invoice).payment_status?.toUpperCase() : 'SETTLED'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isGreen ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                        {isGreen ? '+' : '-'}{formatINR(t.amount)}
                      </td>
                      <td>
                        {t.type === 'invoice' && (
                          <Link href={`/${(t.data as Invoice).invoice_type === 'sale' ? 'sales' : 'purchases'}/` + (t.data as Invoice).id}>
                            <button className="btn btn-ghost btn-sm" title="View"><Icons.Eye size={15} /></button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal 
          contact={contact} 
          type={type} 
          onClose={() => setShowPaymentModal(false)} 
          onSuccess={() => {
            setShowPaymentModal(false)
            load()
          }}
        />
      )}
    </div>
  )
}
