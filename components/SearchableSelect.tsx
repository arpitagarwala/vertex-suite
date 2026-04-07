'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Icons } from './Icons'

interface Option {
  id: string
  name: string
  sub?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  style = {}
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value])

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const s = search.toLowerCase()
    return options.filter(o => 
      o.name.toLowerCase().includes(s) || 
      (o.sub && o.sub.toLowerCase().includes(s))
    )
  }, [options, search])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setActiveIndex(-1)
  }, [search, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev))
        e.preventDefault()
        break
      case 'ArrowUp':
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0))
        e.preventDefault()
        break
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          onChange(filteredOptions[activeIndex].id)
          setIsOpen(false)
          setSearch('')
        }
        e.preventDefault()
        break
      case 'Escape':
        setIsOpen(false)
        setSearch('')
        e.preventDefault()
        break
    }
  }

  return (
    <div 
      ref={containerRef} 
      className={`searchable-select-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="form-input searchable-select-display"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: 'pointer',
          minHeight: '38px',
          padding: '0 var(--space-3)'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ 
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '0.875rem'
        }}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <Icons.ChevronDown size={16} color="var(--text-secondary)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div 
          className="searchable-select-dropdown elevated"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icons.Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                style={{ 
                  paddingLeft: 30, 
                  height: 32, 
                  fontSize: '0.8rem',
                  background: 'rgba(255,255,255,0.03)'
                }}
                placeholder="Type to filter..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          <div style={{ maxHeight: 250, overflowY: 'auto', padding: 'var(--space-1) 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.id}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer',
                    background: idx === activeIndex || opt.id === value ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    borderLeft: opt.id === value ? '2px solid var(--brand-primary)' : '2px solid transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(opt.id)
                    setIsOpen(false)
                    setSearch('')
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: opt.id === value ? 600 : 400, color: 'var(--text-primary)' }}>
                    {opt.name}
                  </div>
                  {opt.sub && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {opt.sub}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
