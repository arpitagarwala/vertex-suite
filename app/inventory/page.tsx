'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/gst'
import type { Product } from '@/lib/types'

import { Suspense } from 'react'

function InventoryContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')

  const [products, setProducts] = useState<(Product & { total_stock: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(filterParam || 'all')
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prods } = await supabase
      .from('products')
      .select('*, category:categories(name, color)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const { data: stock } = await supabase
      .from('stock_summary')
      .select('product_id, current_stock')
      .eq('user_id', user.id)

    const merged = (prods || []).map(p => {
      const stockEntries = stock?.filter(s => s.product_id === p.id) || []
      const total_stock = stockEntries.reduce((s: number, e: { current_stock: number }) => s + (e.current_stock || 0), 0)
      return { ...p, total_stock }
    })
    setProducts(merged)
    setLoading(false)
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    showToast('success', 'Product archived successfully')
    setShowDeleteId(null)
    loadProducts()
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function getStockStatus(product: Product & { total_stock: number }) {
    if (product.total_stock <= 0) return 'out'
    if (product.total_stock <= product.low_stock_alert) return 'low'
    return 'good'
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.hsn_code || '').toLowerCase().includes(search.toLowerCase())
    const status = getStockStatus(p)
    if (filterStatus === 'low') return matchSearch && (status === 'low' || status === 'out')
    if (filterStatus === 'out') return matchSearch && status === 'out'
    return matchSearch
  })

  return (
    <div className="animate-fade">
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✅' : '⚠️'} {toast.msg}</div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{products.length} products · {products.filter(p => getStockStatus(p) !== 'good').length} need attention</p>
        </div>
        <div className="page-actions">
          <Link href="/inventory/add">
            <button className="btn btn-primary" id="add-product-btn">+ Add Product</button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search by name, SKU or HSN code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ minWidth: 240 }}>
          {[['all', 'All'], ['low', '⚠️ Low Stock'], ['out', '🔴 Out of Stock']].map(([v, l]) => (
            <button key={v} className={`tab ${filterStatus === v ? 'active' : ''}`} onClick={() => setFilterStatus(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3>No products found</h3>
          <p>{search ? 'Try a different search term' : 'Add your first product to get started'}</p>
          <Link href="/inventory/add"><button className="btn btn-primary">+ Add Product</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>HSN / SKU</th>
                <th>Price</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = getStockStatus(p)
                return (
                  <tr key={p.id}>
                    <td data-label="Product">
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      {p.category && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: (p.category as { color: string }).color, display: 'inline-block' }} />
                          {(p.category as { name: string }).name}
                        </span>
                      )}
                    </td>
                    <td data-label="HSN/SKU">
                      <div className="monospace" style={{ fontSize: '0.8rem' }}>{p.hsn_code || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sku || ''}</div>
                    </td>
                    <td data-label="Sale Price">
                      <div style={{ fontWeight: 600 }}>{formatINR(p.sale_price)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cost: {formatINR(p.cost_price)}</div>
                    </td>
                    <td data-label="GST">{p.gst_rate}%</td>
                    <td data-label="Stock">
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: status === 'out' ? 'var(--brand-danger)' : status === 'low' ? 'var(--brand-warning)' : 'var(--text-primary)' }}>
                        {p.total_stock} {p.unit}
                      </span>
                    </td>
                    <td data-label="Status">
                      <div className={`flex items-center gap-2 stock-${status}`}>
                        <span className="stock-dot" />
                        <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                          {status === 'out' ? 'Out of Stock' : status === 'low' ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Link href={`/inventory/${p.id}`}>
                          <button className="btn btn-ghost btn-sm" title="View Details">👁️</button>
                        </Link>
                        <Link href={`/inventory/${p.id}/edit`}>
                          <button className="btn btn-ghost btn-sm" title="Edit">✏️</button>
                        </Link>
                        <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => setShowDeleteId(p.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Archive Product?</div>
              <button className="modal-close" onClick={() => setShowDeleteId(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
              This product will be archived and hidden from your inventory. Sales history is preserved.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteProduct(showDeleteId)}>Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: '100vh' }} />}>
      <InventoryContent />
    </Suspense>
  )
}
