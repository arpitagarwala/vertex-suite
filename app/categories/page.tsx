'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Icons } from '@/components/Icons'

export default function CategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [catName, setCatName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name')
    setCategories(data || [])
    setLoading(false)
  }

  function openNew() { setEditingId(null); setCatName(''); setModalOpen(true); }
  function openEdit(id: string, current: string) { setEditingId(id); setCatName(current); setModalOpen(true); }

  async function handleSave() {
    if (!catName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editingId) {
      await supabase.from('categories').update({ name: catName }).eq('id', editingId)
    } else {
      await supabase.from('categories').insert({ user_id: user.id, name: catName })
    }
    setModalOpen(false)
    load()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Products in this category will not be deleted.')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Manage inventory classifications</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Icons.Plus size={15} /> New Category
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Package size={28} /></div>
          <h3>No categories yet</h3>
          <p>Group your products into categories for better reporting.</p>
          <button className="btn btn-primary" onClick={openNew}>Create Category</button>
        </div>
      ) : (
        <div className="table-wrap table-mobile-card" style={{ maxWidth: 800 }}>
          <table className="data-table">
            <thead>
              <tr><th>Category Name</th><th style={{ width: 100, textAlign:'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td data-label="Category Name"><div style={{ fontWeight: 600 }}>{c.name}</div></td>
                  <td data-label="Actions" style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', gap:'var(--space-2)', justifyContent:'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c.id, c.name)}><Icons.Edit size={15} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)' }} onClick={() => deleteCategory(c.id)}><Icons.Trash size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Category' : 'New Category'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><Icons.X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input autoFocus className="form-input" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'var(--space-3)', marginTop:'var(--space-5)' }}>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!catName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
