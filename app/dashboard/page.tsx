'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays, subMonths, subYears, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns'

type RangeType = '1M' | '6M' | '1Y' | 'custom'

const QUICK_ACTIONS = [
  { href: '/sales/new', icon: 'Sales' as const, label: 'New Invoice', color: '#6366f1' },
  { href: '/purchases/new', icon: 'Purchases' as const, label: 'Log Purchase', color: '#06b6d4' },
  { href: '/inventory/add', icon: 'Package' as const, label: 'Add Product', color: '#10b981' },
  { href: '/customers/add', icon: 'Customers' as const, label: 'Add Customer', color: '#f59e0b' },
  { href: '/suppliers', icon: 'Suppliers' as const, label: 'Suppliers', color: '#8b5cf6' },
  { href: '/expenses/add', icon: 'Expenses' as const, label: 'Log Expense', color: '#ec4899' },
  { href: '/reports', icon: 'Reports' as const, label: 'GST Report', color: '#14b8a6' },
  { href: '/settings', icon: 'Settings' as const, label: 'Settings', color: '#94a3b8' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0, totalGST: 0, netProfit: 0, totalPurchases: 0,
    totalProducts: 0, lowStockCount: 0, totalCustomers: 0,
    unpaidAmount: 0, totalInvoices: 0
  })
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([])
  const [businessName, setBusinessName] = useState('My Business')
  const [greeting, setGreeting] = useState('Good morning')
  const [range, setRange] = useState<RangeType>('1M')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [allInvoices, setAllInvoices] = useState<any[]>([])

  useEffect(() => {
    const hr = new Date().getHours()
    setGreeting(hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening')
    loadDashboard()
  }, [])

  useEffect(() => {
    if (allInvoices.length > 0) buildTrend(allInvoices)
  }, [range, customFrom, customTo, allInvoices])

  async function loadDashboard() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: profile }, { data: invoices }, { data: purchases }, { data: expenses }, { data: products }, { data: customers }] = await Promise.all([
      supabase.from('profiles').select('business_name').eq('id', user.id).single(),
      supabase.from('invoices').select('grand_total,total_gst,amount_paid,payment_status,invoice_date').eq('user_id', user.id).eq('status', 'active').eq('invoice_type', 'sale'),
      supabase.from('invoices').select('grand_total').eq('user_id', user.id).eq('status', 'active').eq('invoice_type', 'purchase'),
      supabase.from('expenses').select('amount').eq('user_id', user.id),
      supabase.from('products').select('id').eq('user_id', user.id).eq('is_active', true),
      supabase.from('customers').select('id').eq('user_id', user.id),
    ])

    if (profile?.business_name) setBusinessName(profile.business_name)

    const list = invoices || []
    setAllInvoices(list)
    const totalRevenue = list.reduce((s, i) => s + (i.grand_total || 0), 0)
    const totalGST = list.reduce((s, i) => s + (i.total_gst || 0), 0)
    const totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0
    const totalPurchases = purchases?.reduce((s, p) => s + (p.grand_total || 0), 0) || 0
    const unpaidAmount = list.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + ((i.grand_total || 0) - (i.amount_paid || 0)), 0)

    setStats({
      totalRevenue, totalGST, totalPurchases, unpaidAmount,
      netProfit: totalRevenue - totalExpenses - totalGST,
      totalProducts: products?.length || 0, lowStockCount: 0,
      totalCustomers: customers?.length || 0, totalInvoices: list.length
    })

    setPaymentBreakdown([
      { name: 'Paid', value: list.filter(i => i.payment_status === 'paid').length },
      { name: 'Partial', value: list.filter(i => i.payment_status === 'partial').length },
      { name: 'Unpaid', value: list.filter(i => i.payment_status === 'unpaid').length },
    ])
    buildTrend(list)
    setLoading(false)
  }

  const buildTrend = useCallback((invoices: any[]) => {
    const now = new Date()
    let intervals: { label: string; key: string }[] = []

    if (range === '1M') {
      const days = eachDayOfInterval({ start: subDays(now, 29), end: now })
      intervals = days.map(d => ({ label: format(d, 'dd MMM'), key: format(d, 'yyyy-MM-dd') }))
    } else if (range === '6M') {
      const months = eachMonthOfInterval({ start: subMonths(now, 5), end: now })
      intervals = months.map(m => ({ label: format(m, 'MMM yy'), key: format(m, 'yyyy-MM') }))
    } else if (range === '1Y') {
      const months = eachMonthOfInterval({ start: subYears(now, 1), end: now })
      intervals = months.map(m => ({ label: format(m, 'MMM yy'), key: format(m, 'yyyy-MM') }))
    } else if (range === 'custom' && customFrom && customTo) {
      try {
        const days = eachDayOfInterval({ start: new Date(customFrom), end: new Date(customTo) })
        intervals = days.slice(0, 60).map(d => ({ label: format(d, 'dd MMM'), key: format(d, 'yyyy-MM-dd') }))
      } catch { return }
    }

    const trend = intervals.map(({ label, key }) => ({
      date: label,
      revenue: invoices.filter(i => i.invoice_date?.startsWith(key)).reduce((s, i) => s + (i.grand_total || 0), 0)
    }))
    setRevenueData(trend)
  }, [range, customFrom, customTo])

  const statCards = [
    { label: 'Total Revenue', value: formatINR(stats.totalRevenue), icon: 'TrendUp' as const, color: '#10b981' },
    { label: 'GST Liability', value: formatINR(stats.totalGST), icon: 'FileText' as const, color: '#6366f1', sub: 'Keep aside' },
    { label: 'Net Profit', value: formatINR(stats.netProfit), icon: 'BarChart' as const, color: '#06b6d4' },
    { label: 'Unpaid Bills', value: formatINR(stats.unpaidAmount), icon: 'AlertTriangle' as const, color: '#f59e0b', sub: `${stats.totalInvoices} invoices` },
    { label: 'Products', value: stats.totalProducts.toString(), icon: 'Package' as const, color: '#8b5cf6', sub: `${stats.lowStockCount} low stock` },
    { label: 'Customers', value: stats.totalCustomers.toString(), icon: 'Customers' as const, color: '#ec4899' },
  ]

  if (loading) return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: 160 }} />
      </div>
      <div className="grid grid-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />)}
      </div>
    </div>
  )

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">{businessName} · {format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="page-actions">
          <Link href="/sales/new"><button className="btn btn-primary" id="dash-new-sale" style={{ display:'flex', alignItems:'center', gap:6 }}><Icons.Plus size={15} /> New Sale</button></Link>
          <Link href="/inventory/add"><button className="btn btn-secondary" id="dash-add-product" style={{ display:'flex', alignItems:'center', gap:6 }}><Icons.Package size={15} /> Add Product</button></Link>
        </div>
      </div>

      {/* GST Reserve Alert */}
      {stats.totalGST > 0 && (
        <div className="highlight-card" style={{ marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Icons.Zap size={22} color="#6366f1" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>GST Reserve Reminder</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Keep <strong style={{ color: 'var(--brand-primary-light)' }}>{formatINR(stats.totalGST)}</strong> aside for your GST filing this month.
            </p>
          </div>
          <Link href="/reports"><button className="btn btn-secondary btn-sm">View Report →</button></Link>
        </div>
      )}

      {/* Quick Actions — moved above stats */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>Quick Actions</h3>
        <div className="quick-actions-grid">
          {QUICK_ACTIONS.map((a, i) => {
            const IconComp = Icons[a.icon]
            return (
              <Link key={i} href={a.href}>
                <div className="quick-action-card">
                  <div className="quick-action-icon" style={{ background: `${a.color}1a`, color: a.color }}>
                    <IconComp size={20} color={a.color} />
                  </div>
                  <span>{a.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((s, i) => {
          const IconComp = Icons[s.icon]
          return (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-icon" style={{ background: `${s.color}1a` }}>
                  <IconComp size={18} color={s.color} />
                </div>
              </div>
              <div className="stat-value number-ticker">{s.value}</div>
              {s.sub && <div className="stat-sub">{s.sub}</div>}
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-2 gap-6" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Revenue Chart */}
        <div className="card elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Revenue Trend</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {(['1M','6M','1Y','custom'] as RangeType[]).map(r => (
                <button key={r} className={`range-pill ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  {r === 'custom' ? 'Custom' : r}
                </button>
              ))}
            </div>
          </div>
          {range === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-3)' }}>
              <input type="date" className="form-input" style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px' }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <input type="date" className="form-input" style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px' }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          <div className="chart-container" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }} formatter={(v: any) => [formatINR(Number(v) || 0), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Pie */}
        <div className="card elevated">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Payment Status</h3>
          </div>
          <div className="chart-container" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {paymentBreakdown.map((_, i) => <Cell key={i} fill={['#10b981','#f59e0b','#ef4444'][i]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{val}</span>} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: var(--space-3);
        }
        .quick-action-card {
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--space-2);
          padding: var(--space-3) var(--space-2);
          height: 100%;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-align: center;
          font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .quick-action-card:hover { background: var(--bg-card-hover); border-color: var(--border-brand); color: var(--text-primary); transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .quick-action-icon { width: 38px; height: 38px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
        @media (max-width: 1024px) { .quick-actions-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 768px) {
          .grid-3 { grid-template-columns: repeat(2, 1fr); }
          .quick-actions-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 480px) {
          .quick-actions-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  )
}
