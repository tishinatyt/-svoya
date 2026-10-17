import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoMetadata } from '../lib/seo'

/** Keep metadata correct during client navigation; production HTML already has it. */
export default function SiteMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = pathname === '/' ? 'home' : /^\/club\/?$/.test(pathname) ? 'club' : 'not-found'
    const meta = seoMetadata(page, import.meta.env.BASE_URL)
    document.title = meta.title
    const update = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name'
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
      if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, name); document.head.append(tag) }
      tag.content = content
    }
    update('description', meta.description); update('robots', meta.robots)
    update('og:title', meta.title, true); update('og:description', meta.description, true)
    update('twitter:title', meta.title); update('twitter:description', meta.description)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (meta.canonical) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
      canonical.href = meta.canonical; update('og:url', meta.canonical, true)
    } else { canonical?.remove(); document.head.querySelector('meta[property="og:url"]')?.remove() }
    let schema = document.getElementById('svoya-schema')
    if (meta.schema) {
      if (!schema) { schema = document.createElement('script'); schema.id = 'svoya-schema'; schema.setAttribute('type', 'application/ld+json'); document.head.append(schema) }
      schema.textContent = JSON.stringify(meta.schema)
    } else schema?.remove()
  }, [pathname])
  return null
}
