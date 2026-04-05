'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icons } from '@/components/Icons'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { format } from 'date-fns'
import type { Expense } from '@/lib/types'

export default function ExpenseCategoryDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category
  const decodedCategory = decodeURIComponent(categoryParam || '').toLowerCase()

  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [decodedCategory])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .ilike('category', decodedCategory)
      .order('expense_date', { ascending: false })
      
    setExpenses(data || [])
    setLoading(false)
  }

  async function deleteExpense(id: string) {
    if (!confirm('Are you sure you want to delete this expense record?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  const headingText = decodedCategory.charAt(0).toUpperCase() + decodedCategory.slice(1)
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-icon" onClick={() => router.push('/expenses')} style={{ marginLeft: '-8px' }}>
               <Icons.ChevronLeft size={20} />
            </button>
            <h1 className="page-title">{headingText} Expenses</h1>
          </div>
          <p className="page-subtitle">Detailed breakdown of all '{headingText}' transactions</p>
        </div>
      </div>

      <div className="stat-card" style={{ marginBottom: 'var(--space-6)', maxWidth: 300, '--accent-color': '#8b5cf6' } as React.CSSProperties}>
          <div className="stat-label">Total Spent on {headingText}</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{formatINR(total)}</div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : expenses.length === 0 ? (
         <div className="empty-state">
           <h3>No records found</h3>
           <p>There are no detailed records under this category.</p>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
             <thead>
                <tr>
                   <th>Date</th>
                   <th>Description</th>
                   <th>Payment Method</th>
                   <th>Amount</th>
                   <th>Actions</th>
                </tr>
             </thead>
             <tbody>
                {expenses.map(e => (
                   <tr key={e.id}>
                      <td data-label="Date">{format(new Date(e.expense_date), 'dd MMM yyyy')}</td>
                      <td data-label="Description">{e.description}</td>
                      <td data-label="Payment Method" style={{ textTransform: 'capitalize' }}>{e.payment_method}</td>
                      <td data-label="Amount"><strong style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(e.amount)}</strong></td>
                      <td data-label="Actions">
                         <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/expenses/${e.id}/edit`)}>
                               <Icons.Edit size={16} /> Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={() => deleteExpense(e.id)}>
                               <Icons.Trash size={16} /> Delete
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
