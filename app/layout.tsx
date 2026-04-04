import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://vertex.arpitagarwala.online'),
  title: {
    default: 'Vertex Suite — Smart Business Management for India',
    template: '%s | Vertex Suite'
  },
  description: 'GST-ready business management for Indian SMBs. Professional invoicing, inventory tracking, and financial reporting in one unified suite.',
  keywords: ['GST Billing Software', 'Inventory Management India', 'Small Business Accounting', 'GSTR-1 Export', 'Cloud Billing', 'Vertex Suite'],
  authors: [{ name: 'Arpit Agarwala' }],
  creator: 'Arpit Agarwala',
  publisher: 'Vertex Suite',
  manifest: '/manifest.json',
  icons: { 
    icon: '/logo.svg', 
    apple: '/logo.svg' 
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Vertex Suite',
    description: 'Smart business management for Indian SMBs',
    url: 'https://vertex.arpitagarwala.online',
    siteName: 'Vertex Suite',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vertex Suite',
    description: 'Smart business management for Indian SMBs',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vertex Suite" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
