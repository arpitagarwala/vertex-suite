'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/Icons'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import type { Expense } from '@/lib/types'

export default function ExpensesPage() {
  const router = useRouter()
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
    setExpenses(data || [])
    setLoading(false)
  }

  const grouped = expenses.reduce((acc, curr) => {
    const cat = curr.category || 'Other'
    if (!acc[cat]) acc[cat] = { totalAmount: 0, count: 0, recentDate: curr.expense_date }
    acc[cat].totalAmount += curr.amount || 0
    acc[cat].count += 1
    if (new Date(curr.expense_date) > new Date(acc[cat].recentDate)) {
      acc[cat].recentDate = curr.expense_date
    }
    return acc
  }, {} as Record<string, { totalAmount: number; count: number; recentDate: string }>)

  const sortedGroups = Object.entries(grouped).sort((a, b) => b[1].totalAmount - a[1].totalAmount)
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track operational costs and overheads (Grouped by Category)</p>
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
      ) : sortedGroups.length === 0 ? (
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
                   <th>Expense Category</th>
                   <th>Total Transactions</th>
                   <th>Total Amount Spent</th>
                   <th>Actions</th>
                </tr>
             </thead>
             <tbody>
                {sortedGroups.map(([category, stats]) => (
                   <tr key={category}>
                      <td data-label="Category">
                        <div style={{ fontWeight:600, textTransform: 'capitalize' }}>{category}</div>
                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Last logged: {new Date(stats.recentDate).toLocaleDateString()}</div>
                      </td>
                      <td data-label="Transactions">
                        <span className="badge badge-secondary">{stats.count} transaction{stats.count !== 1 ? 's' : ''}</span>
                      </td>
                      <td data-label="Amount Spent">
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(stats.totalAmount)}</strong>
                      </td>
                      <td data-label="Actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/expenses/category/${encodeURIComponent(category.toLowerCase())}`)}>
                          View Details →
                        </button>
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
