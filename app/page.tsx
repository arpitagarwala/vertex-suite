'use client'
import Link from 'next/link'
import { Icons } from '@/components/Icons'

export default function LandingPage() {
  return (
    <div className="landing-page" style={{ background:'var(--bg-base)', minHeight:'100vh', overflowX:'hidden' }}>
      {/* Navbar */}
      <nav style={{ height:'var(--topbar-height)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 var(--space-6)', position:'fixed', top:0, left:0, right:0, zIndex:100, background:'var(--bg-overlay)', backdropFilter:'var(--glass-blur)', borderBottom:'1px solid var(--border-subtle)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:'var(--brand-primary)', width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icons.Package size={20} color="#fff" />
          </div>
          <span style={{ fontWeight:800, fontSize:'1.25rem', letterSpacing:'-0.02em' }}>Vertex <span style={{ color:'var(--brand-primary-light)' }}>Suite</span></span>
        </div>
        <Link href="/login">
          <button className="btn btn-ghost" style={{ fontWeight:600 }}>Sign In</button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section style={{ paddingTop:'calc(var(--topbar-height) + var(--space-16))', paddingBottom:'var(--space-16)', position:'relative' }}>
        <div className="login-blob login-blob-1" style={{ top:'10%', left:'10%' }} />
        <div className="login-blob login-blob-2" style={{ bottom:'10%', right:'10%', background:'var(--brand-secondary)' }} />
        
        <div style={{ maxWidth:'800px', margin:'0 auto', textAlign:'center', padding:'0 var(--space-6)', position:'relative', zIndex:1 }}>
          <div className="animate-slide-up" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'4px 12px', background:'rgba(99, 102, 241, 0.1)', border:'1px solid rgba(99, 102, 241, 0.2)', borderRadius:20, color:'var(--brand-primary-light)', fontSize:'0.8rem', fontWeight:600, marginBottom:'var(--space-6)' }}>
            <Icons.Zap size={14} /> Built for Indian SMBs
          </div>
          <h1 className="animate-slide-up" style={{ fontSize:'clamp(2.5rem, 8vw, 4rem)', fontWeight:900, lineHeight:1.1, marginBottom:'var(--space-6)', color:'#fff' }}>
            Smart Business <br/> <span style={{ background:'linear-gradient(to right, var(--brand-primary-light), var(--brand-secondary))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Management</span> for Everyone
          </h1>
          <p className="animate-slide-up" style={{ fontSize:'1.125rem', color:'var(--text-secondary)', marginBottom:'var(--space-10)', maxWidth:'600px', margin:'0 auto var(--space-10)' }}>
            Transform your business with high-speed GST invoicing, predictive inventory tracking, and beautiful financial reports. 
          </p>
          <div className="animate-slide-up" style={{ display:'flex', gap:'var(--space-4)', justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/login">
              <button className="btn btn-primary btn-lg" style={{ display:'flex', alignItems:'center', gap:8 }}>Get Started Free <Icons.ChevronRight size={18} /></button>
            </Link>
            <button className="btn btn-secondary btn-lg">Watch Demo</button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding:'var(--space-16) 0', background:'var(--bg-surface)' }}>
        <div style={{ maxWidth:'var(--content-max)', margin:'0 auto', padding:'0 var(--space-6)' }}>
          <div style={{ textAlign:'center', marginBottom:'var(--space-16)' }}>
            <h2 style={{ marginBottom:'var(--space-4)' }}>One Suite. Total Control.</h2>
            <p style={{ maxWidth:'500px', margin:'0 auto' }}>Everything you need to run your shop, warehouse, or agency from any device.</p>
          </div>
          
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'var(--space-8)' }}>
            <div className="card glass animate-fade">
              <div style={{ width:48, height:48, borderRadius:12, background:'rgba(245, 158, 11, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'var(--space-6)' }}>
                <Icons.Inventory size={24} color="var(--brand-accent)" />
              </div>
              <h3 style={{ marginBottom:'var(--space-3)' }}>Smart Inventory</h3>
              <p style={{ fontSize:'0.95rem' }}>Predictive stock alerts, HSN mapping, and multi-location warehouse management. Never lose a sale due to "Out of Stock".</p>
            </div>
            
            <div className="card glass animate-fade">
              <div style={{ width:48, height:48, borderRadius:12, background:'rgba(16, 185, 129, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'var(--space-6)' }}>
                <Icons.Sales size={24} color="var(--brand-success)" />
              </div>
              <h3 style={{ marginBottom:'var(--space-3)' }}>GST Ready Billing</h3>
              <p style={{ fontSize:'0.95rem' }}>Create professional GST-compliant invoices in seconds. Instant sharing over WhatsApp or Email. Built for the Indian market.</p>
            </div>
            
            <div className="card glass animate-fade">
              <div style={{ width:48, height:48, borderRadius:12, background:'rgba(6, 182, 212, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'var(--space-6)' }}>
                <Icons.PieChart size={24} color="var(--brand-secondary)" />
              </div>
              <h3 style={{ marginBottom:'var(--space-3)' }}>Powerful Analytics</h3>
              <p style={{ fontSize:'0.95rem' }}>Real-time profit tracking, GST reserve alerts, and expense management. Know your numbers, grow your wealth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section style={{ padding:'var(--space-16) 0', position:'relative' }}>
        <div style={{ maxWidth:'var(--content-max)', margin:'0 auto', padding:'0 var(--space-6)', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'var(--space-16)', alignItems:'center' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--brand-primary-light)', fontWeight:600, fontSize:'0.875rem', marginBottom:'var(--space-4)' }}>
              <Icons.Shield size={18} /> Enterprise-Grade Security
            </div>
            <h2 style={{ marginBottom:'var(--space-6)', fontSize:'2.5rem' }}>Your data is your <br/> business. Period.</h2>
            <p style={{ fontSize:'1.1rem', marginBottom:'var(--space-8)' }}>
              We use military-grade AES-256 encryption to protect your sensitive financial records. Your data is backed up daily and accessible only by you.
            </p>
            <ul style={{ display:'grid', gap:'var(--space-4)' }}>
              <li style={{ display:'flex', alignItems:'center', gap:10 }}><Icons.Check size={20} color="var(--brand-success)" /> End-to-end data encryption</li>
              <li style={{ display:'flex', alignItems:'center', gap:10 }}><Icons.Check size={20} color="var(--brand-success)" /> Periodic security audits</li>
              <li style={{ display:'flex', alignItems:'center', gap:10 }}><Icons.Check size={20} color="var(--brand-success)" /> 99.9% uptime guaranteed</li>
            </ul>
          </div>
          
          <div className="card glass elevated" style={{ padding:'var(--space-8)', textAlign:'center' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(99, 102, 241, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto var(--space-6)' }}>
              <Icons.Lock size={40} color="var(--brand-primary-light)" />
            </div>
            <h3>Bank-Level Privacy</h3>
            <p style={{ marginTop:'var(--space-4)' }}>Trusted by over 10,000+ businesses across India for their daily operations and financial record keeping.</p>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer style={{ padding:'var(--space-16) 0', background:'var(--bg-surface)', borderTop:'1px solid var(--border-subtle)', textAlign:'center' }}>
        <div style={{ maxWidth:'var(--content-max)', margin:'0 auto', padding:'0 var(--space-6)' }}>
          <h2 style={{ marginBottom:'var(--space-6)' }}>Ready to scale your business?</h2>
          <Link href="/login">
            <button className="btn btn-primary btn-lg">Start Using Vertex Suite Free</button>
          </Link>
          <div style={{ marginTop:'var(--space-12)', paddingTop:'var(--space-8)', borderTop:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'var(--space-6)', fontSize:'0.875rem', color:'var(--text-muted)' }}>
            <div>© 2026 Vertex Suite. All rights reserved.</div>
            <div style={{ display:'flex', gap:'var(--space-6)' }}>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Contact Us</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
