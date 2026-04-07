'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { 
  format, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, 
  startOfYear, endOfYear, isWithinInterval, parseISO, eachDayOfInterval,
  subMonths, eachMonthOfInterval
} from 'date-fns'

type RangeType = 'today' | 'this_month' | 'this_quarter' | 'this_fy' | 'custom'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0, 
    totalGST: 0, 
    grossProfit: 0,
    netProfit: 0, 
    totalPurchases: 0,
    totalExpenses: 0,
    totalProducts: 0, 
    lowStockCount: 0, 
    totalCustomers: 0,
    unpaidSales: 0,
    unpaidPurchases: 0,
    totalInvoices: 0,
    totalPurchaseTaxable: 0,
    totalPurchaseGST: 0,
    gstLiability: 0,
    totalCOGS: 0
  })
  
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([])
  const [businessName, setBusinessName] = useState('My Business')
  const [greeting, setGreeting] = useState('Good morning')
  const [range, setRange] = useState<RangeType>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Date Range Helper
  const dateRange = useMemo(() => {
    const now = new Date()
    const month = now.getMonth() // 0-indexed
    const year = now.getFullYear()
    
    // Financial Year logic (April to March)
    const fyStartYear = month >= 3 ? year : year - 1
    const fyStart = new Date(fyStartYear, 3, 1) // April 1st
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59) // March 31st next year

    switch (range) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
      case 'this_month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') }
      case 'this_quarter':
        return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(endOfQuarter(now), 'yyyy-MM-dd') }
      case 'this_fy':
        return { start: format(fyStart, 'yyyy-MM-dd'), end: format(fyEnd, 'yyyy-MM-dd') }
      case 'custom':
        return { start: customFrom || format(now, 'yyyy-MM-dd'), end: customTo || format(now, 'yyyy-MM-dd') }
      default:
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
    }
  }, [range, customFrom, customTo])

  useEffect(() => {
    const hr = new Date().getHours()
    setGreeting(hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening')
    loadDashboard()
  }, [range, customFrom, customTo])

  async function loadDashboard() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = dateRange

    const [
      { data: profile }, 
      { data: sales }, 
      { data: purchases }, 
      { data: expenses }, 
      { data: products }, 
      { data: customers },
      { data: stock }
    ] = await Promise.all([
      supabase.from('profiles').select('business_name').eq('id', user.id).single(),
      supabase.from('invoices').select('*, items:invoice_items(*)')
        .eq('user_id', user.id).eq('status', 'active').eq('invoice_type', 'sale')
        .gte('invoice_date', start).lte('invoice_date', end),
      supabase.from('invoices').select('*')
        .eq('user_id', user.id).eq('status', 'active').eq('invoice_type', 'purchase')
        .gte('invoice_date', start).lte('invoice_date', end),
      supabase.from('expenses').select('*')
        .eq('user_id', user.id)
        .gte('expense_date', start).lte('expense_date', end),
      supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('customers').select('*').eq('user_id', user.id),
      supabase.from('stock_summary').select('product_id, current_stock').eq('user_id', user.id)
    ])

    if (profile?.business_name) setBusinessName(profile.business_name)

    const salesList = sales || []
    const purchaseList = purchases || []
    const expenseList = expenses || []
    const productList = products || []

    const totalRevenue = salesList.reduce((s, i) => s + (i.grand_total || 0), 0)
    const totalSaleTaxable = salesList.reduce((s, i) => s + (i.taxable_amount || 0), 0)
    const totalSaleGST = salesList.reduce((s, i) => s + (i.total_gst || 0), 0)
    
    const totalPurchaseTotal = purchaseList.reduce((s, i) => s + (i.grand_total || 0), 0)
    const totalPurchaseTaxable = purchaseList.reduce((s, i) => s + (i.taxable_amount || 0), 0)
    const totalPurchaseGST = purchaseList.reduce((s, i) => s + (i.total_gst || 0), 0)
    
    const totalExpenses = expenseList.reduce((s, e) => s + (e.amount || 0), 0)
    const unpaidSales = salesList.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + ((i.grand_total || 0) - (i.amount_paid || 0)), 0)
    const unpaidPurchases = purchaseList.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + ((i.grand_total || 0) - (i.amount_paid || 0)), 0)

    // COGS Calculation: Sum of (Sale Quantity * Product WAC)
    let totalCOGS = 0
    salesList.forEach(sale => {
      sale.items?.forEach((item: any) => {
        const product = productList.find(p => p.id === item.product_id)
        if (product) {
          totalCOGS += (item.quantity || 0) * (product.cost_price || 0)
        }
      })
    })

    const grossProfit = totalSaleTaxable - totalCOGS
    const netProfit = grossProfit - totalExpenses
    const gstLiability = totalSaleGST - totalPurchaseGST

    // Low stock count
    const lowStockCount = productList.filter(p => {
      const pStock = stock?.filter(s => s.product_id === p.id).reduce((sum, entry) => sum + (entry.current_stock || 0), 0) || 0
      return pStock <= p.low_stock_alert
    }).length

    setStats({
      totalRevenue, 
      totalGST: totalSaleGST, 
      grossProfit,
      netProfit,
      totalPurchases: totalPurchaseTotal,
      totalExpenses,
      totalProducts: productList.length,
      lowStockCount,
      totalCustomers: customers?.length || 0,
      totalInvoices: salesList.length,
      totalPurchaseTaxable,
      totalPurchaseGST,
      gstLiability,
      unpaidSales,
      unpaidPurchases,
      totalCOGS
    })

    setPaymentBreakdown([
      { name: 'Paid', value: salesList.filter(i => i.payment_status === 'paid').length },
      { name: 'Partial', value: salesList.filter(i => i.payment_status === 'partial').length },
      { name: 'Unpaid', value: salesList.filter(i => i.payment_status === 'unpaid').length },
    ])

    // Category distribution from sales
    const catMap: Record<string, number> = {}
    salesList.forEach(inv => {
      inv.items?.forEach((item: any) => {
        const cat = item.product_id ? 'Product' : 'Other'
        catMap[cat] = (catMap[cat] || 0) + (item.total_amount || 0)
      })
    })
    setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })))

    // Trend Logic
    const trendRange = range === 'this_fy' ? 12 : range === 'this_quarter' ? 3 : 1
    let intervals: { label: string; key: string }[] = []
    
    if (trendRange > 1) {
      const months = eachMonthOfInterval({ start: parseISO(start), end: parseISO(end) })
      intervals = months.map(m => ({ label: format(m, 'MMM'), key: format(m, 'yyyy-MM') }))
    } else {
      const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
      intervals = days.map(d => ({ label: format(d, 'd MMM'), key: format(d, 'yyyy-MM-dd') }))
    }

    const trend = intervals.map(({ label, key }) => ({
      date: label,
      revenue: salesList.filter(i => i.invoice_date?.startsWith(key)).reduce((s, i) => s + (i.grand_total || 0), 0),
      purchases: purchaseList.filter(i => i.invoice_date?.startsWith(key)).reduce((s, i) => s + (i.grand_total || 0), 0)
    }))
    setRevenueData(trend)
    
    setLoading(false)
  }

  const statCards = [
    // Row 1: Income / Profitability
    { label: 'Sale Revenue', value: formatINR(stats.totalRevenue), icon: 'TrendUp' as const, color: '#10b981', sub: `${stats.totalInvoices} sales`, href: '/sales' },
    { label: 'Gross Profit', value: formatINR(stats.grossProfit), icon: 'BarChart' as const, color: '#6366f1', sub: 'Revenue - COGS', href: '' },
    { label: 'Net Profit', value: formatINR(stats.netProfit), icon: 'Zap' as const, color: '#8b5cf6', sub: 'Gross - Expenses', href: '' },

    // Row 2: Expenditures / Liabilities
    { label: 'Inventory Spent', value: formatINR(stats.totalPurchases), icon: 'Package' as const, color: '#14b8a6', sub: 'Total procurement', href: '/purchases' },
    { label: 'Total Expenses', value: formatINR(stats.totalExpenses), icon: 'Expenses' as const, color: '#ec4899', sub: 'Fixed & Variable', href: '/expenses' },
    { label: 'Tax Liability', value: formatINR(stats.gstLiability), icon: 'FileText' as const, color: '#f59e0b', sub: `ITC: ${formatINR(stats.totalPurchaseGST)}`, href: '/reports' },

    // Row 3: Operations / Action Items
    { label: 'Receivables', value: formatINR(stats.unpaidSales), icon: 'AlertTriangle' as const, color: '#fb7185', sub: 'Unpaid sales', href: '/sales?filter=pending' },
    { label: 'Payables', value: formatINR(stats.unpaidPurchases), icon: 'Suppliers' as const, color: '#94a3b8', sub: 'Unpaid purchases', href: '/purchases?filter=pending' },
    { label: 'Low Stock Alerts', value: stats.lowStockCount.toString(), icon: 'AlertTriangle' as const, color: '#f97316', sub: 'Items needing restock', href: '/products?filter=low_stock' },
  ]

  if (loading) return (
    <div className="animate-fade">
      <div className="skeleton" style={{ height: 60, width: '100%', marginBottom: 24, borderRadius: 12 }} />
      <div className="grid grid-3 gap-4">
        {[...Array(9)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
      </div>
    </div>
  )

  return (
    <div className="animate-fade">
      {/* Global Filter Bar */}
      <div className="dashboard-filter-bar elevated" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="filter-header">
          <div className="filter-title">
            <h1 className="page-title">{greeting}</h1>
            <p className="page-subtitle">{businessName} Analytics</p>
          </div>
          <div className="filter-options">
            <div className="range-selector">
              {(['today','this_month','this_quarter','this_fy','custom'] as RangeType[]).map(r => (
                <button key={r} className={`range-pill ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  {r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="custom-dates">
                <input type="date" className="form-input-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <span>to</span>
                <input type="date" className="form-input-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            )}
            <div className="action-buttons">
              <Link href="/sales/new"><button className="btn btn-primary btn-sm">+ Sale</button></Link>
              <Link href="/expenses/add"><button className="btn btn-secondary btn-sm">+ Expense</button></Link>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-1 md:grid-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((s, i) => {
          const IconComp = Icons[s.icon]
          const card = (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color, cursor: s.href ? 'pointer' : 'default' } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-icon" style={{ background: `${s.color}1a` }}>
                  <IconComp size={16} color={s.color} />
                </div>
              </div>
              <div className="stat-value">{s.value}</div>
              {s.sub && <div className="stat-sub">{s.sub}</div>}
              <div className="stat-progress-bg"><div className="stat-progress-bar" style={{ width: '40%', background: s.color }} /></div>
            </div>
          )
          return s.href ? <Link key={i} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link> : card
        })}
      </div>

      {/* Performance Section */}
      <div className="grid grid-1 md:grid-2 gap-6" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Sales vs Purchases Trend */}
        <div className="card elevated">
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Income & Spending</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparison of total sales and purchase history in the selected period</p>
          </div>
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }} />
                <Legend iconType="circle" />
                <Area type="monotone" name="Sales" dataKey="revenue" stroke="#10b981" strokeWidth={3} fill="url(#sGrad)" />
                <Area type="monotone" name="Purchases" dataKey="purchases" stroke="#06b6d4" strokeWidth={3} fill="url(#pGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="card elevated">
           <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Payment Health</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Distribution of paid vs unpaid sales invoices</p>
          </div>
          <div className="chart-container" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={65} outerRadius={90} dataKey="value" paddingAngle={4}>
                  {paymentBreakdown.map((_, i) => <Cell key={i} fill={['#10b981','#f59e0b','#ef4444'][i]} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Legend iconType="circle" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-1 md:grid-3 gap-6">
        {/* Quick Links */}
        <div className="card md:col-span-2">
           <h3 className="section-title">Quick Actions</h3>
           <div className="quick-actions-flex">
              {[
                { href: '/sales/new', icon: 'Plus', label: 'Sale', color:'#10b981' },
                { href: '/purchases/new', icon: 'Purchases', label: 'Purchase', color:'#06b6d4' },
                { href: '/inventory/add', icon: 'Package', label: 'Product', color:'#6366f1' },
                { href: '/expenses/add', icon: 'Expenses', label: 'Expense', color:'#ec4899' },
                { href: '/customers/add', icon: 'Customers', label: 'Customer', color:'#3b82f6' },
                { href: '/reports', icon: 'Reports', label: 'Reports', color:'#14b8a6' },
              ].map((a, i) => {
                const IconComp = Icons[a.icon as keyof typeof Icons]
                return (
                  <Link href={a.href} key={i}>
                    <div className="action-tile">
                      <div className="action-tile-icon" style={{ background: `${a.color}1a`, color: a.color }}>
                        <IconComp size={22} />
                      </div>
                      <span className="action-tile-label">{a.label}</span>
                    </div>
                  </Link>
                )
              })}
           </div>
        </div>

        {/* Total Stats summary */}
        <div className="card">
           <h3 className="section-title">Global Summary</h3>
           <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
              {[
                { label: 'Active Products', val: stats.totalProducts, icon: 'Package' },
                { label: 'Customers Count', val: stats.totalCustomers, icon: 'Customers' },
                { label: 'Invoices Total', val: stats.totalInvoices, icon: 'FileText' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap: 12 }}>
                   <div style={{ width: 36, height:36, borderRadius:8, background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icons.ChevronRight size={16} color="var(--text-muted)" />
                   </div>
                   <div style={{ flex: 1 }}>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{item.label}</div>
                      <div style={{ fontWeight:700 }}>{item.val}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <style>{`
        .dashboard-filter-bar {
          background: var(--bg-card); padding: var(--space-5); border-radius: 16px; border: 1px solid var(--border-subtle);
        }
        .filter-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); }
        .filter-options { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
        .range-selector { display: flex; background: var(--bg-elevated); padding: 4px; border-radius: 12px; }
        .range-pill { border: none; background: transparent; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); border-radius: 10px; cursor: pointer; transition: all 0.2s; }
        .range-pill.active { background: var(--bg-card); color: var(--brand-primary-light); box-shadow: var(--shadow-sm); }
        .custom-dates { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-muted); }
        .form-input-sm { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 4px 8px; border-radius: 8px; font-size: 0.8rem; }
        
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .stat-card {
          background: var(--bg-card); padding: 1.25rem; border-radius: 16px; border: 1px solid var(--border-subtle); position: relative; overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--accent-color); }
        .stat-label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 1.25rem; font-weight: 800; margin: 8px 0; font-family: var(--font-mono); color: var(--text-primary); }
        .stat-sub { font-size: 0.72rem; color: var(--text-muted); font-weight: 500; }
        .stat-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .stat-progress-bg { position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: rgba(0,0,0,0.05); }
        .stat-progress-bar { height: 100%; opacity: 0.4; border-radius: 0 2px 2px 0; }
        
        .section-title { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 20px; }
        .quick-actions-flex { display: flex; gap: 16px; flex-wrap: wrap; }
        .action-tile { display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .action-tile:hover { transform: scale(1.05); }
        .action-tile-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .action-tile-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }

        @media (max-width: 768px) {
          .filter-header { flex-direction: column; align-items: flex-start; }
          .filter-options { width: 100%; }
          .range-selector { width: 100%; overflow-x: auto; }
        }
      `}</style>
    </div>
  )
}
