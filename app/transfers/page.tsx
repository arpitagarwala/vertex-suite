'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import type { StockTransfer } from '@/lib/types'

export default function TransfersPage() {
  const supabase = createClient()
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, from_location:locations!from_location_id(name), to_location:locations!to_location_id(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTransfers(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    await supabase.from('stock_transfers').update({ status: newStatus }).eq('id', id)
    
    // If completing the transfer, execute the stock movements
    if (newStatus === 'completed') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const transfer = transfers.find(t => t.id === id)
      if (!transfer) return

      const { data: items } = await supabase.from('stock_transfer_items').select('*').eq('transfer_id', id)
      
      if (items && items.length > 0) {
        // deduct from source, add to destination
        const movements = []
        for (const item of items) {
          if (transfer.from_location_id) {
            movements.push({
              user_id: user.id, product_id: item.product_id, location_id: transfer.from_location_id,
              quantity: -item.quantity, movement_type: 'transfer_out', reference_id: transfer.id, reference_type: 'transfer'
            })
          }
          if (transfer.to_location_id) {
            movements.push({
              user_id: user.id, product_id: item.product_id, location_id: transfer.to_location_id,
              quantity: item.quantity, movement_type: 'transfer_in', reference_id: transfer.id, reference_type: 'transfer'
            })
          }
        }
        if (movements.length > 0) {
          await supabase.from('stock_ledger').insert(movements)
        }
      }
    }
    
    load()
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Stock Transfers</h1>
          <p className="page-subtitle">Manage C&F and inter-warehouse stock movement</p>
        </div>
        <div className="page-actions">
          <Link href="/transfers/new">
            <button className="btn btn-primary">+ New Transfer</button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : transfers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚚</div>
          <h3>No transfers yet</h3>
          <p>Move stock between your warehouses or C&F agents</p>
          <Link href="/transfers/new"><button className="btn btn-primary">+ New Transfer</button></Link>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRN Number</th>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td data-label="TRN Number">
                    <span className="monospace" style={{ fontWeight: 600 }}>{t.transfer_number}</span>
                  </td>
                  <td data-label="Date">
                    {format(new Date(t.transfer_date), 'dd MMM yyyy')}
                  </td>
                  <td data-label="From">{t.from_location?.name || '—'}</td>
                  <td data-label="To" style={{ fontWeight: 600 }}>{t.to_location?.name || '—'}</td>
                  <td data-label="Status">
                     {t.status === 'completed' ? <span className="badge badge-success">Completed</span> : 
                      t.status === 'in_transit' ? <span className="badge badge-warning">In Transit</span> : 
                      t.status === 'cancelled' ? <span className="badge badge-danger">Cancelled</span> :
                      <span className="badge badge-secondary">Pending</span>}
                  </td>
                  <td data-label="Actions">
                    {t.status === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => updateStatus(t.id, 'in_transit')}>Ship</button>}
                    {t.status === 'in_transit' && <button className="btn btn-success btn-sm" onClick={() => updateStatus(t.id, 'completed')}>Receive & Sync Stock</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
