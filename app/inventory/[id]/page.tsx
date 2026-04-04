'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import { Icons } from '@/components/Icons'
import { format } from 'date-fns'

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [product, setProduct] = useState<any>(null)
  const [stockByLocation, setStockByLocation] = useState<any[]>([])
  const [recentMovements, setRecentMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: prod } = await supabase.from('products').select('*').eq('id', id).single()
    if (!prod) { router.push('/inventory'); return }
    setProduct(prod)

    const { data: stock } = await supabase.from('stock_summary').select('*, location:locations(name)').eq('product_id', id)
    setStockByLocation(stock || [])

    const { data: movements } = await supabase.from('stock_ledger')
      .select('*, location:locations(name)')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setRecentMovements(movements || [])
    setLoading(false)
  }

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
  if (!product) return null

  const totalStock = stockByLocation.reduce((s, l) => s + (l.current_stock || 0), 0)

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{product.name}</h1>
          <p className="page-subtitle">{product.hsn_code ? `HSN: ${product.hsn_code}` : 'No HSN code'} · {product.gst_rate}% GST</p>
        </div>
        <div className="page-actions">
          <Link href={`/inventory/${id}/edit`}>
            <button className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Icons.Edit size={15} /> Edit Product
            </button>
          </Link>
          <button className="btn btn-secondary" onClick={() => router.back()} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Icons.ChevronDown size={15} style={{ transform:'rotate(90deg)' }} /> Back
          </button>
        </div>
      </div>

      <div className="grid grid-2 gap-6" style={{ marginBottom:'var(--space-6)' }}>
        <div className="card">
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Product Details</h3>
          {[
            ['SKU', product.sku || '—'],
            ['HSN Code', product.hsn_code || '—'],
            ['Unit', product.unit || 'pcs'],
            ['Sale Price', formatINR(product.sale_price)],
            ['Cost Price', formatINR(product.cost_price)],
            ['GST Rate', `${product.gst_rate}%`],
            ['Low Stock Alert', `${product.low_stock_alert} ${product.unit}`],
          ].map(([label, val]) => (
            <div key={label} className="gst-breakdown-row">
              <span style={{ color:'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight:600 }}>{val}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Stock by Location</h3>
          {stockByLocation.length === 0 ? (
            <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No stock data. Add stock via a purchase entry.</p>
          ) : (
            stockByLocation.map((s, i) => (
              <div key={i} className="gst-breakdown-row">
                <span style={{ color:'var(--text-muted)' }}>{s.location?.name || 'Unknown'}</span>
                <span style={{ fontWeight:700, color: s.current_stock <= 0 ? 'var(--brand-danger)' : s.current_stock <= product.low_stock_alert ? 'var(--brand-warning)' : 'var(--brand-success)' }}>
                  {s.current_stock} {product.unit}
                </span>
              </div>
            ))
          )}
          <div className="gst-breakdown-row total">
            <span>Total Stock</span>
            <span style={{ fontWeight:800, fontFamily:'var(--font-mono)' }}>{totalStock} {product.unit}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-4)' }}>Recent Stock Movements</h3>
        {recentMovements.length === 0 ? (
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No stock movements recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Location</th><th>Qty</th></tr></thead>
              <tbody>
                {recentMovements.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{format(new Date(m.created_at), 'dd MMM yyyy')}</td>
                    <td><span className={`badge badge-${m.movement_type==='purchase'?'success':m.movement_type==='sale'?'danger':'secondary'}`}>{m.movement_type}</span></td>
                    <td style={{ fontSize:'0.875rem' }}>{m.location?.name || '—'}</td>
                    <td style={{ fontWeight:700, fontFamily:'var(--font-mono)', color: m.quantity>0?'var(--brand-success)':'var(--brand-danger)' }}>{m.quantity>0?'+':''}{m.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
