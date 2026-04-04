'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons } from '@/components/Icons'

type NavItem = { href: string; icon: keyof typeof Icons; label: string; section: string; cnfOnly?: boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: 'Dashboard', label: 'Dashboard', section: 'main' },
  { href: '/inventory', icon: 'Inventory', label: 'Inventory', section: 'main' },
  { href: '/sales', icon: 'Sales', label: 'Sales', section: 'main' },
  { href: '/purchases', icon: 'Purchases', label: 'Purchases', section: 'main' },
  { href: '/customers', icon: 'Customers', label: 'Customers', section: 'main' },
  { href: '/suppliers', icon: 'Suppliers', label: 'Suppliers', section: 'main' },
  { href: '/transfers', icon: 'Transfers', label: 'C&F Transfers', section: 'operations', cnfOnly: true },
  { href: '/expenses', icon: 'Expenses', label: 'Expenses', section: 'operations' },
  { href: '/reports', icon: 'Reports', label: 'Reports & GST', section: 'reports' },
  { href: '/settings', icon: 'Settings', label: 'Settings', section: 'settings' },
]

type BottomNavItem = { href: string; icon: keyof typeof Icons; label: string }

const BOTTOM_NAV: BottomNavItem[] = [
  { href: '/dashboard', icon: 'Dashboard', label: 'Home' },
  { href: '/inventory', icon: 'Inventory', label: 'Stock' },
  { href: '/sales', icon: 'Sales', label: 'Sales' },
  { href: '/purchases', icon: 'Purchases', label: 'Purchases' },
  { href: '/settings', icon: 'Settings', label: 'More' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [businessName, setBusinessName] = useState('My Business')
  const [userEmail, setUserEmail] = useState('')
  const [enableCnf, setEnableCnf] = useState(false)
  const [profileIncomplete, setProfileIncomplete] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      supabase.from('profiles')
        .select('business_name, enable_cnf, gstin')
        .eq('id', data.user.id)
        .single()
        .then(({ data: p }) => {
          if (p?.business_name) setBusinessName(p.business_name)
          setEnableCnf(p?.enable_cnf ?? false)
          // Show warning if business name or gstin is missing
          if (!p?.business_name || !p?.gstin) setProfileIncomplete(true)
        })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const sections = ['main', 'operations', 'reports', 'settings']
  const sectionLabels: Record<string, string> = {
    main: 'Main', operations: 'Operations', reports: 'Analytics', settings: 'Account'
  }

  const visibleNavItems = NAV_ITEMS.filter(item => !item.cnfOnly || enableCnf)

  return (
    <div className="app-shell">
      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.svg" alt="Vertex" style={{ width:32, height:32, borderRadius:6 }} />
          <div className="sidebar-logo-text">
            Vertex <span>Suite</span>
            <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', fontWeight:500, letterSpacing:0, marginTop:1 }}>Smart Business Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => {
            const items = visibleNavItems.filter(n => n.section === section)
            if (items.length === 0) return null
            return (
              <div key={section}>
                <div className="nav-section-label">{sectionLabels[section]}</div>
                {items.map(item => {
                  const IconComp = Icons[item.icon as keyof typeof Icons]
                  return (
                    <Link key={item.href} href={item.href}
                      className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}>
                      <IconComp size={17} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-3)' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', fontWeight:700, flexShrink:0, color:'#fff' }}>
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{businessName}</div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userEmail}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm btn-full" onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
            <Icons.LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <button className="btn btn-icon btn-ghost" onClick={() => setSidebarOpen(!sidebarOpen)} id="menu-toggle" aria-label="Menu" style={{ display:'none' }}>
            <Icons.Menu size={20} />
          </button>

          {/* Profile Incomplete Warning */}
          {profileIncomplete && (
            <div className="profile-warning-banner" onClick={() => router.push('/settings')} title="Click to complete profile">
              <Icons.AlertTriangle size={14} color="#f59e0b" />
              <span>Business profile incomplete — <strong>complete setup →</strong></span>
            </div>
          )}

          <div style={{ flex:1 }} />
          <Link href="/sales/new">
            <button className="btn btn-primary btn-sm" id="topbar-new-sale" style={{ display:'flex', alignItems:'center', gap:'var(--space-1)' }}>
              <Icons.Plus size={15} />
              New Sale
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
          {BOTTOM_NAV.map(item => {
            const IconComp = Icons[item.icon as keyof typeof Icons]
            return (
              <Link key={item.href} href={item.href}
                className={`bottom-nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
                <IconComp size={22} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <style>{`
        @media screen and (max-width: 992px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0 !important; }
          #menu-toggle { display: flex !important; margin-right: var(--space-1); }
          .topbar { padding: 0 var(--space-4); }
        }
        
        @media screen and (max-width: 640px) {
          .profile-warning-banner { max-width: 130px; }
          .profile-warning-banner span { display: none; }
        }

        .profile-warning-banner {
          display: flex; align-items: center; gap: 6px;
          background: rgba(245,158,11,0.10);
          border: 1px solid rgba(245,158,11,0.25);
          color: #f59e0b;
          font-size: 0.78rem;
          padding: 5px 12px;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: background var(--transition-fast);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-warning-banner:hover { background: rgba(245,158,11,0.18); }
      `}</style>
    </div>
  )
}
