'use client'
import { useState, useEffect, useMemo } from 'react'
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
  const [fullHistory, setFullHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: prod } = await supabase.from('products').select('*, category:categories(name)').eq('id', id).single()
    if (!prod) { router.push('/inventory'); return }
    setProduct(prod)

    const [stockRes, movementsRes, historyRes] = await Promise.all([
      supabase.from('stock_summary').select('*, location:locations(name)').eq('product_id', id),
      supabase.from('stock_ledger').select('*, location:locations(name)').eq('product_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('invoice_items').select('*, invoice:invoices!invoice_id(*)').eq('product_id', id).order('created_at', { ascending: false })
    ])

    setStockByLocation(stockRes.data || [])
    setRecentMovements(movementsRes.data || [])
    setFullHistory(historyRes.data || [])
    setLoading(false)
  }

  const analysis = useMemo(() => {
    const purchases = fullHistory.filter(h => h.invoice?.invoice_type === 'purchase')
    const sales = fullHistory.filter(h => h.invoice?.invoice_type === 'sale')
    
    const totalSaleQty = sales.reduce((s, h) => s + (h.quantity || 0), 0)
    const totalSaleValue = sales.reduce((s, h) => s + (h.taxable_amount || 0), 0)
    const avgSalePrice = totalSaleQty > 0 ? totalSaleValue / totalSaleQty : 0

    return { purchases, sales, avgSalePrice, totalSaleQty }
  }, [fullHistory])

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
  if (!product) return null

  const totalStock = stockByLocation.reduce((s, l) => s + (l.current_stock || 0), 0)
  const margin = analysis.avgSalePrice > 0 ? ((analysis.avgSalePrice - product.cost_price) / analysis.avgSalePrice) * 100 : 0

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <h1 className="page-title">{product.name}</h1>
            {product.category && <span className="badge badge-secondary">{product.category.name}</span>}
          </div>
          <p className="page-subtitle">{product.sku ? `SKU: ${product.sku}` : 'No SKU'} · {product.hsn_code ? `HSN: ${product.hsn_code}` : 'No HSN'} · {product.gst_rate}% GST</p>
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

      {/* Analysis Row */}
      <div className="grid grid-3 gap-4" style={{ marginBottom:'var(--space-6)' }}>
        <div className="stat-card" style={{ '--accent-color': '#6366f1' } as any}>
          <div className="stat-label">Weighted Avg Cost</div>
          <div className="stat-value">{formatINR(product.cost_price)}</div>
          <div className="stat-sub">Based on previous purchases</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': '#10b981' } as any}>
          <div className="stat-label">Weighted Avg Sale</div>
          <div className="stat-value">{formatINR(analysis.avgSalePrice)}</div>
          <div className="stat-sub">From {analysis.totalSaleQty} {product.unit} sold</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': margin >= 0 ? '#06b6d4' : '#ef4444' } as any}>
          <div className="stat-label">Realized Margin</div>
          <div className="stat-value">{margin.toFixed(1)}%</div>
          <div className="stat-sub">Avg Sale vs Avg Cost</div>
        </div>
      </div>

      <div className="grid grid-2 gap-6" style={{ marginBottom:'var(--space-6)' }}>
        {/* Core Details */}
        <div className="card">
          <h3 className="section-title">📦 Product Spec</h3>
          {[
            ['SKU / Code', product.sku || '—'],
            ['HSN / SAC', product.hsn_code || '—'],
            ['Unit', product.unit || 'pcs'],
            ['Current Stock', `${totalStock} ${product.unit}`],
            ['Alert Level', `${product.low_stock_alert} ${product.unit}`],
          ].map(([label, val]) => (
            <div key={label} className="gst-breakdown-row">
              <span style={{ color:'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight:600 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Stock by Location */}
        <div className="card">
          <h3 className="section-title">📍 Stock Distribution</h3>
          {stockByLocation.length === 0 ? (
            <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No stock locations active for this product.</p>
          ) : (
            stockByLocation.map((s, i) => (
              <div key={i} className="gst-breakdown-row">
                <span style={{ color:'var(--text-muted)' }}>{s.location?.name || 'Warehouse'}</span>
                <span style={{ fontWeight:700, color: s.current_stock <= 0 ? 'var(--brand-danger)' : s.current_stock <= product.low_stock_alert ? 'var(--brand-warning)' : 'var(--brand-success)' }}>
                  {s.current_stock} {product.unit}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Tables */}
      <div className="grid grid-1 gap-6">
        {/* Purchase History */}
        <div className="card">
          <h3 className="section-title">🧾 Purchase History (WAC Source)</h3>
          {analysis.purchases.length === 0 ? (
             <p className="empty-text">No purchase history recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Vendor / Source</th><th>Qty</th><th>Purchase Rate</th><th>Total</th></tr></thead>
                <tbody>
                  {analysis.purchases.map((h, i) => (
                    <tr key={i}>
                      <td>{format(new Date(h.invoice?.invoice_date), 'dd MMM yy')}</td>
                      <td style={{ fontWeight:600 }}>{h.invoice?.customer_name}</td>
                      <td>{h.quantity} {h.unit}</td>
                      <td style={{ fontWeight:700 }}>{formatINR(h.unit_price)}</td>
                      <td style={{ color:'var(--text-muted)' }}>{formatINR(h.taxable_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales History */}
        <div className="card">
          <h3 className="section-title">🛒 Sales Performance</h3>
          {analysis.sales.length === 0 ? (
             <p className="empty-text">No sales history yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Customer</th><th>Qty</th><th>Sale Rate</th><th>Total</th></tr></thead>
                <tbody>
                  {analysis.sales.map((h, i) => (
                    <tr key={i}>
                      <td>{format(new Date(h.invoice?.invoice_date), 'dd MMM yy')}</td>
                      <td style={{ fontWeight:600 }}>{h.invoice?.customer_name}</td>
                      <td>{h.quantity} {h.unit}</td>
                      <td style={{ fontWeight:700, color:'var(--brand-primary-light)' }}>{formatINR(h.unit_price)}</td>
                      <td style={{ color:'var(--text-muted)' }}>{formatINR(h.taxable_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .section-title { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 20px; }
        .empty-text { color: var(--text-muted); font-size: 0.875rem; text-align: center; padding: 20px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
        .badge-secondary { background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
      `}</style>
    </div>
  )
}
