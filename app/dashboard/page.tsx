'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0, totalGST: 0, netProfit: 0,
    totalProducts: 0, lowStockCount: 0, totalCustomers: 0,
    unpaidAmount: 0, totalInvoices: 0
  })
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; expenses: number }[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; value: number }[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([])
  const [businessName, setBusinessName] = useState('My Business')
  const [greeting, setGreeting] = useState('Good morning')

  useEffect(() => {
    const hr = new Date().getHours()
    if (hr < 12) setGreeting('Good morning')
    else if (hr < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Profile
    const { data: profile } = await supabase.from('profiles').select('business_name').eq('id', user.id).single()
    if (profile?.business_name) setBusinessName(profile.business_name)

    // Stats from invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('grand_total, total_gst, amount_paid, payment_status, invoice_date, customer_name')
      .eq('user_id', user.id).eq('status', 'active').eq('invoice_type', 'sale')

    const totalRevenue = invoices?.reduce((s, i) => s + (i.grand_total || 0), 0) || 0
    const totalGST = invoices?.reduce((s, i) => s + (i.total_gst || 0), 0) || 0
    const unpaidAmount = invoices?.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + ((i.grand_total || 0) - (i.amount_paid || 0)), 0) || 0
    const totalInvoices = invoices?.length || 0

    // Expenses
    const { data: expenses } = await supabase.from('expenses').select('amount').eq('user_id', user.id)
    const totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0

    // Products
    const { data: products } = await supabase.from('products').select('id').eq('user_id', user.id).eq('is_active', true)
    const totalProducts = products?.length || 0

    // Low stock from view
    const { data: stockData } = await supabase.from('stock_summary').select('current_stock, low_stock_alert').eq('user_id', user.id)
    const lowStockCount = stockData?.filter(s => s.current_stock <= s.low_stock_alert).length || 0

    // Customers
    const { data: customers } = await supabase.from('customers').select('id').eq('user_id', user.id)
    const totalCustomers = customers?.length || 0

    setStats({ totalRevenue, totalGST, netProfit: totalRevenue - totalExpenses - totalGST, totalProducts, lowStockCount, totalCustomers, unpaidAmount, totalInvoices })

    // Revenue trend (last 7 days)
    const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
    const trend = days.map(day => {
      const label = format(day, 'dd MMM')
      const dayStr = format(day, 'yyyy-MM-dd')
      const rev = invoices?.filter(i => i.invoice_date?.startsWith(dayStr)).reduce((s, i) => s + (i.grand_total || 0), 0) || 0
      const exp = expenses?.filter?.(() => false) ? 0 : 0 // placeholder
      return { date: label, revenue: rev, expenses: exp }
    })
    setRevenueData(trend)

    // Payment breakdown
    const cash = invoices?.filter(i => i.payment_status === 'paid').length || 0
    const partial = invoices?.filter(i => i.payment_status === 'partial').length || 0
    const unpaid = invoices?.filter(i => i.payment_status === 'unpaid').length || 0
    setPaymentBreakdown([
      { name: 'Paid', value: cash },
      { name: 'Partial', value: partial },
      { name: 'Unpaid', value: unpaid },
    ])

    setLoading(false)
  }

  const statCards = [
    { label: 'Total Revenue', value: formatINR(stats.totalRevenue), icon: '💰', color: '#10b981', trend: '+12%', up: true },
    { label: 'GST Liability', value: formatINR(stats.totalGST), icon: '📋', color: '#6366f1', sub: 'Keep this aside' },
    { label: 'Net Profit', value: formatINR(stats.netProfit), icon: '📈', color: '#06b6d4', trend: stats.netProfit > 0 ? '+' : '', up: stats.netProfit > 0 },
    { label: 'Unpaid Bills', value: formatINR(stats.unpaidAmount), icon: '⏳', color: '#f59e0b', sub: `${stats.totalInvoices} invoices` },
    { label: 'Products', value: stats.totalProducts.toString(), icon: '📦', color: '#8b5cf6', sub: `${stats.lowStockCount} low stock` },
    { label: 'Customers', value: stats.totalCustomers.toString(), icon: '👥', color: '#ec4899', sub: 'Total registered' },
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
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{greeting}, 👋</h1>
          <p className="page-subtitle">{businessName} · {format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="page-actions">
          <Link href="/sales/new">
            <button className="btn btn-primary" id="dash-new-sale">+ New Sale</button>
          </Link>
          <Link href="/inventory/add">
            <button className="btn btn-secondary" id="dash-add-product">+ Add Product</button>
          </Link>
        </div>
      </div>

      {/* GST Reserve Alert */}
      {stats.totalGST > 0 && (
        <div className="highlight-card" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              GST Reserve Reminder
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Keep <strong style={{ color: 'var(--brand-primary-light)' }}>{formatINR(stats.totalGST)}</strong> aside for your GST filing this month.
            </p>
          </div>
          <Link href="/reports">
            <button className="btn btn-secondary btn-sm">View Report →</button>
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': s.color } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-icon" style={{ background: `${s.color}1a` }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
              </div>
            </div>
            <div className="stat-value number-ticker">{s.value}</div>
            {s.trend && (
              <div className={`stat-trend ${s.up ? 'up' : 'down'}`}>
                {s.up ? '↑' : '↓'} {s.trend} this month
              </div>
            )}
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-2 gap-6" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Revenue Area Chart */}
        <div className="card elevated">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Revenue Trend</h3>
            <span className="badge badge-secondary">Last 7 Days</span>
          </div>
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
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(v: any) => [formatINR(Number(v) || 0), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Status Pie */}
        <div className="card elevated">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Payment Status</h3>
          </div>
          <div className="chart-container" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8}
                  formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{val}</span>} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low Stock Warning */}
      {stats.lowStockCount > 0 && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-warning)' }}>
                {stats.lowStockCount} product{stats.lowStockCount > 1 ? 's' : ''} running low on stock
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Reorder soon to avoid stockouts and missed sales.
              </p>
            </div>
            <Link href="/inventory?filter=low">
              <button className="btn btn-warning btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--brand-warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
                View Stock →
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Quick Actions</h3>
        <div className="grid grid-4 gap-3">
          {[
            { href: '/sales/new', icon: '🧾', label: 'New Invoice' },
            { href: '/inventory/add', icon: '📦', label: 'Add Product' },
            { href: '/customers/add', icon: '👤', label: 'Add Customer' },
            { href: '/transfers/new', icon: '🚚', label: 'C&F Transfer' },
            { href: '/expenses/add', icon: '💸', label: 'Log Expense' },
            { href: '/reports', icon: '📊', label: 'GST Report' },
            { href: '/inventory', icon: '🔍', label: 'View Stock' },
            { href: '/settings', icon: '⚙️', label: 'Settings' },
          ].map((a, i) => (
            <Link key={i} href={a.href}>
              <div className="quick-action-card">
                <span style={{ fontSize: '1.4rem' }}>{a.icon}</span>
                <span>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .quick-action-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-4);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-align: center;
          font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .quick-action-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-brand);
          color: var(--text-primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        @media (max-width: 768px) {
          .grid-3 { grid-template-columns: repeat(2, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .grid-4 { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
