'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Landing / redirect root to dashboard or login
export default function RootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/login') }, [router])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0f' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(135deg,#6366f1,#06b6d4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Aura Inventory
        </div>
        <p style={{ color:'#475569', marginTop:'0.5rem', fontFamily:'Inter,sans-serif' }}>Loading...</p>
      </div>
    </div>
  )
}
