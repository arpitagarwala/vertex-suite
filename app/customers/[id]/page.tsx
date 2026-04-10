'use client'
import { useParams } from 'next/navigation'
import ContactLedger from '@/components/ContactLedger'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="container" style={{ padding: 'var(--space-6) 0' }}>
      <ContactLedger id={id} type="customer" />
    </div>
  )
}
