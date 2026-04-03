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

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
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
            <h1 className="login-title">Vertex <span>Suite</span></h1>
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

          <button 
            type="button" 
            className="btn btn-secondary btn-full" 
            style={{ marginBottom: 'var(--space-5)', background: '#ffffff', color: '#000' }}
            onClick={signInWithGoogle}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: 8 }} xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <hr style={{ flex: 1, borderColor: 'var(--border-subtle)', margin: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>or with email</span>
            <hr style={{ flex: 1, borderColor: 'var(--border-subtle)', margin: 0 }} />
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
