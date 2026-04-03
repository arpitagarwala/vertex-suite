'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard', section: 'main' },
  { href: '/inventory', icon: '📦', label: 'Inventory', section: 'main' },
  { href: '/sales', icon: '🧾', label: 'Sales', section: 'main' },
  { href: '/purchases', icon: '🛒', label: 'Purchases', section: 'main' },
  { href: '/customers', icon: '👥', label: 'Customers', section: 'main' },
  { href: '/transfers', icon: '🚚', label: 'C&F Transfers', section: 'operations' },
  { href: '/expenses', icon: '💸', label: 'Expenses', section: 'operations' },
  { href: '/reports', icon: '📈', label: 'Reports & GST', section: 'reports' },
  { href: '/settings', icon: '⚙️', label: 'Settings', section: 'settings' },
]

const BOTTOM_NAV = [
  { href: '/dashboard', icon: '📊', label: 'Home' },
  { href: '/inventory', icon: '📦', label: 'Stock' },
  { href: '/sales', icon: '🧾', label: 'Sales' },
  { href: '/reports', icon: '📈', label: 'Reports' },
  { href: '/settings', icon: '⚙️', label: 'More' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [businessName, setBusinessName] = useState('My Business')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      supabase.from('profiles').select('business_name').eq('id', data.user.id).single()
        .then(({ data: p }) => { if (p?.business_name) setBusinessName(p.business_name) })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sections = ['main', 'operations', 'reports', 'settings']
  const sectionLabels: Record<string, string> = {
    main: 'Main', operations: 'Operations', reports: 'Analytics', settings: 'Account'
  }

  return (
    <div className="app-shell">
      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">📦</div>
          <div className="sidebar-logo-text">Aura <span>Inventory</span></div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => {
            const items = NAV_ITEMS.filter(n => n.section === section)
            return (
              <div key={section}>
                <div className="nav-section-label">{sectionLabels[section]}</div>
                {items.map(item => (
                  <Link key={item.href} href={item.href}
                    className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}>
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-3)' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', fontWeight:700, flexShrink:0 }}>
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{businessName}</div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userEmail}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm btn-full" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <button className="btn btn-icon btn-ghost" onClick={() => setSidebarOpen(!sidebarOpen)} id="menu-toggle" style={{ display:'none' }} aria-label="Menu">
            ☰
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:500 }}>
              {businessName}
            </div>
          </div>
          <Link href="/sales/new">
            <button className="btn btn-primary btn-sm" id="topbar-new-sale">
              + New Sale
            </button>
          </Link>
        </header>

        {/* Page */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Bottom Nav (Mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {BOTTOM_NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`bottom-nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
              <span style={{ fontSize:'1.2rem' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          #menu-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
