export type SeoPage = 'home' | 'club' | 'not-found'
export const SITE_ORIGIN = 'https://tishinatyt.github.io'

export function seoMetadata(page: SeoPage, base = '/-svoya/') {
  const path = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')
  const home = `${SITE_ORIGIN}${path}`
  const title = page === 'home' ? 'СВОЯ — жіночий клуб у Чернігові | Подруги та зустрічі'
    : page === 'club' ? 'Спільнота СВОЯ — зустрічі, подруги та спілкування'
      : 'Сторінку не знайдено — СВОЯ'
  const description = page === 'home'
    ? 'Жіночий клуб СВОЯ у Чернігові: нові подруги, зустрічі за кавою, кола за інтересами, б’юті, бізнес і взаємодопомога. Знайди своє коло. Для жінок 18+.'
    : page === 'club'
      ? 'Платформа жіночого клубу СВОЯ: події, кола за інтересами та чат «Теревеньки». Увійди до спільноти, щоб знайомитися й будувати спільні плани.'
      : 'Такої сторінки у СВОЯ немає. Перейди на головну або відкрий платформу жіночого клубу.'
  const canonical = page === 'home' ? home : page === 'club' ? `${home}club/` : null
  const image = `${home}brand/svoya-social.jpg`
  const schema = page !== 'home' ? null : {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${home}#organization`,
        name: 'СВОЯ', alternateName: 'SVOYA', url: home, description,
        logo: { '@type': 'ImageObject', url: `${home}brand/svoya-symbol-20261011.png`, width: 512, height: 512 },
        areaServed: { '@type': 'City', name: 'Чернігів' },
      },
      {
        '@type': 'WebSite', '@id': `${home}#website`, url: home,
        name: 'СВОЯ — жіночий клуб', alternateName: 'SVOYA', inLanguage: 'uk-UA',
        publisher: { '@id': `${home}#organization` },
      },
      {
        '@type': 'WebPage', '@id': `${home}#webpage`, url: home, name: title,
        description, inLanguage: 'uk-UA', isPartOf: { '@id': `${home}#website` },
        about: { '@id': `${home}#organization` },
        primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 800 },
      },
    ],
  }
  return { title, description, canonical, image, schema,
    robots: page === 'home' ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    home,
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export function seoHead(page: SeoPage, base = '/-svoya/') {
  const meta = seoMetadata(page, base)
  const tag = (name: string, content: string, property = false) =>
    `<meta ${property ? 'property' : 'name'}="${name}" content="${escapeHtml(content)}" />`
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag('description', meta.description), tag('robots', meta.robots),
    meta.canonical ? `<link rel="canonical" href="${meta.canonical}" />` : '',
    tag('og:type', 'website', true), tag('og:site_name', 'СВОЯ', true),
    tag('og:locale', 'uk_UA', true), tag('og:title', meta.title, true),
    tag('og:description', meta.description, true),
    meta.canonical ? tag('og:url', meta.canonical, true) : '',
    tag('og:image', meta.image, true), tag('og:image:type', 'image/jpeg', true),
    tag('og:image:width', '1200', true), tag('og:image:height', '800', true),
    tag('og:image:alt', 'СВОЯ — знайомства та спілкування за кавою', true),
    tag('twitter:card', 'summary_large_image'), tag('twitter:title', meta.title),
    tag('twitter:description', meta.description), tag('twitter:image', meta.image),
    tag('twitter:image:alt', 'СВОЯ — знайомства та спілкування за кавою'),
    meta.schema ? `<script id="svoya-schema" type="application/ld+json">${JSON.stringify(meta.schema).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ')
}
