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
          <h1 className="page-title">Product Categories</h1>
          <p className="page-subtitle">Organize your inventory for better tracking and reports</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icons.Plus size={18} /> New Category
        </button>
      </div>

      {loading ? (
        <div className="grid grid-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="empty-state card elevated">
          <div className="empty-state-icon">
            <Icons.Inventory size={48} color="var(--brand-primary-light)" />
          </div>
          <h3>No categories yet</h3>
          <p>Create categories like 'Electronics', 'Grocery', or 'Raw Materials' to organize your products.</p>
          <button className="btn btn-primary" onClick={openNew} style={{ display:'flex', alignItems:'center', gap:8, marginTop: 'var(--space-4)' }}>
             <Icons.Plus size={18} /> Create First Category
          </button>
        </div>
      ) : (
        <div className="grid grid-3 gap-4">
          {categories.map(c => (
            <div key={c.id} className="card elevated" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: 'var(--space-4) var(--space-5)' }}>
              <div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.05em', marginBottom:4 }}>Category</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{c.name}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c.id, c.name)} title="Edit Category">
                  <Icons.Edit size={16} />
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--brand-danger)' }} onClick={() => deleteCategory(c.id)} title="Delete">
                  <Icons.Trash size={16} />
                </button>
              </div>
            </div>
          ))}
          <div className="card" style={{ border:'2px dashed var(--border-subtle)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', minHeight:100, cursor:'pointer' }} onClick={openNew}>
             <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-muted)', fontWeight:600 }}>
               <Icons.Plus size={20} /> Add New
             </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal animate-slide-up" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Category' : 'New Category'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><Icons.X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--space-6) 0' }}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input autoFocus className="form-input" placeholder="e.g. Mobile Accessories" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
              </div>
            </div>
            <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:'var(--space-3)', marginTop:'var(--space-2)' }}>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!catName.trim()} style={{ padding: '0.6rem 1.5rem' }}>
                {editingId ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
