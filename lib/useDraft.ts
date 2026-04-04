// Persistent draft hook using localStorage
// Usage: const [form, setForm] = useDraft('draft_key', defaultValue)
import { useState, useEffect, useRef } from 'react'

export function useDraft<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const stored = localStorage.getItem(`vs_draft_${key}`)
      if (stored) return JSON.parse(stored)
    } catch {}
    return defaultValue
  })

  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    try {
      localStorage.setItem(`vs_draft_${key}`, JSON.stringify(state))
    } catch {}
  }, [state, key])

  const clearDraft = () => {
    try { localStorage.removeItem(`vs_draft_${key}`) } catch {}
  }

  return [state, setState, clearDraft]
}
