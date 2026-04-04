import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/inventory', '/sales', '/purchases', '/customers', '/suppliers', '/settings', '/api/'],
    },
    sitemap: 'https://vertex.arpitagarwala.online/sitemap.xml',
  }
}
