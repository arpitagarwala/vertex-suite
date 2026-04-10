'use client'
import { useParams } from 'next/navigation'
import ContactLedger from '@/components/ContactLedger'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="container" style={{ padding: 'var(--space-6) 0' }}>
      <ContactLedger id={id} type="supplier" />
    </div>
  )
}
