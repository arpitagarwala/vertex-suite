'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/Icons'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format } from 'date-fns'
import type { Expense } from '@/lib/types'

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track operational costs and overheads</p>
        </div>
        <div className="page-actions">
          <Link href="/expenses/add">
            <button className="btn btn-primary">+ Log Expense</button>
          </Link>
        </div>
      </div>

      <div className="stat-card" style={{ marginBottom: 'var(--space-6)', maxWidth: 300, '--accent-color': '#ef4444' } as React.CSSProperties}>
          <div className="stat-label">Total Expenses Logged</div>
          <div className="stat-value" style={{ color: 'var(--brand-danger)' }}>{formatINR(total)}</div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : expenses.length === 0 ? (
         <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.Expenses size={48} color="var(--brand-danger)" />
            </div>
           <h3>No expenses logged</h3>
           <p>Start tracking your business overheads</p>
           <Link href="/expenses/add"><button className="btn btn-primary">+ Log Expense</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
             <thead>
                <tr>
                   <th>Date</th>
                   <th>Category</th>
                   <th>Description</th>
                   <th>Payment Method</th>
                   <th>Amount</th>
                </tr>
             </thead>
             <tbody>
                {expenses.map(e => (
                   <tr key={e.id}>
                      <td data-label="Date">{format(new Date(e.expense_date), 'dd MMM yyyy')}</td>
                      <td data-label="Category"><span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{e.category}</span></td>
                      <td data-label="Description">{e.description}</td>
                      <td data-label="Payment Method" style={{ textTransform: 'capitalize' }}>{e.payment_method}</td>
                      <td data-label="Amount"><strong style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(e.amount)}</strong></td>
                   </tr>
                ))}
             </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
