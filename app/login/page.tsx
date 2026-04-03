'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message) }
      else if (data.user) {
        // Update business name in profile
        if (businessName) {
          await supabase.from('profiles').update({ business_name: businessName }).eq('id', data.user.id)
        }
        setMessage('Account created! Please check your email to verify.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      {/* Background Blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className="login-container animate-fade">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">📦</div>
          <div>
            <h1 className="login-title">Aura <span>Inventory</span></h1>
            <p className="login-tagline">Smart business management for India</p>
          </div>
        </div>

        {/* Card */}
        <div className="card elevated login-card">
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
              Sign In
            </button>
            <button className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError('') }}>
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label">Business Name <span className="required">*</span></label>
                <input className="form-input" placeholder="e.g. Sharma Traders" value={businessName} onChange={e => setBusinessName(e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address <span className="required">*</span></label>
              <input className="form-input" type="email" placeholder="you@business.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && <div className="toast toast-error" style={{ position:'static', animation:'none' }}>⚠️ {error}</div>}
            {message && <div className="toast toast-success" style={{ position:'static', animation:'none' }}>✅ {message}</div>}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? <span className="animate-spin">⏳</span> : null}
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign:'center', marginTop:'var(--space-4)', fontSize:'0.8rem', color:'var(--text-muted)' }}>
              No account yet?{' '}
              <button onClick={() => setMode('signup')} style={{ color:'var(--brand-primary-light)', fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>
                Create one free
              </button>
            </p>
          )}
        </div>

        <p style={{ textAlign:'center', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'var(--space-4)' }}>
          🔒 Your data is encrypted and secure · Free forever
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          position: relative;
          overflow: hidden;
        }
        .login-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.15;
        }
        .login-blob-1 {
          width: 500px; height: 500px;
          background: var(--brand-primary);
          top: -200px; left: -200px;
        }
        .login-blob-2 {
          width: 400px; height: 400px;
          background: var(--brand-secondary);
          bottom: -150px; right: -150px;
        }
        .login-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          justify-content: center;
        }
        .login-logo-icon {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
        }
        .login-title {
          font-size: 1.5rem; font-weight: 800;
          letter-spacing: -0.03em;
        }
        .login-title span { color: var(--brand-primary-light); }
        .login-tagline { font-size: 0.8rem; color: var(--text-muted); }
        .login-card { padding: var(--space-6); }
        .required { color: var(--brand-danger); }
      `}</style>
    </div>
  )
}
