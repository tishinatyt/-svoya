import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const base = `/${(process.env.VITE_BASE_PATH || '/-svoya/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')
const canonical = `https://tishinatyt.github.io${base}`
const pages = {}
for (const [name, file] of Object.entries({home:'index.html',club:'club/index.html',missing:'404.html'})) {
  const html = await readFile(`dist/${file}`, 'utf8')
  const doc = new JSDOM(html).window.document
  pages[name] = doc
  assert.equal(doc.documentElement.lang, 'uk')
  assert.equal(doc.querySelectorAll('title').length, 1)
  assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1)
  assert.equal(doc.querySelectorAll('meta[name="robots"]').length, 1)
  assert.equal(doc.querySelector('meta[property="og:image"]').content, `${canonical}brand/svoya-social.jpg`)
  assert.equal(doc.querySelector('meta[name="twitter:card"]').content, 'summary_large_image')
  assert.ok(!html.includes('%BASE_URL%') && !html.includes('__SVOYA_BASE__'))
}
assert.equal(pages.home.querySelector('link[rel="canonical"]').href, canonical)
assert.equal(pages.club.querySelector('link[rel="canonical"]').href, `${canonical}club/`)
assert.equal(pages.missing.querySelector('link[rel="canonical"]'), null)
assert.ok(pages.home.querySelector('meta[name="robots"]').content.startsWith('index,'))
for (const name of ['club','missing']) {
  assert.equal(pages[name].querySelector('meta[name="robots"]').content, 'noindex, follow')
  assert.equal(pages[name].querySelector('script[type="application/ld+json"]'), null)
}
assert.equal(pages.home.querySelectorAll('h1').length, 1)
assert.ok(pages.home.querySelector('main').textContent.includes('жіночий клуб'))
assert.ok(pages.home.querySelector('main').textContent.includes('Обери логін і пароль'))
assert.ok(pages.home.querySelectorAll('main a[href]').length >= 10)
assert.equal(pages.home.querySelector('#root').dataset.prerendered, 'home')
assert.equal(pages.club.querySelector('#root').textContent, '')
assert.equal(pages.club.querySelector('#root').dataset.prerendered, undefined)
assert.equal(pages.missing.querySelector('script:not([type="application/ld+json"])'), null)
const schema = JSON.parse(pages.home.querySelector('#svoya-schema').textContent)
assert.equal(schema['@context'], 'https://schema.org')
assert.deepEqual(schema['@graph'].map(node=>node['@type']), ['Organization','WebSite','WebPage'])
assert.ok(schema['@graph'].every(node => node.url === canonical))
assert.equal(schema['@graph'][2].isPartOf['@id'], schema['@graph'][1]['@id'])
assert.equal(schema['@graph'][1].publisher['@id'], schema['@graph'][0]['@id'])
const urls = new Set()
for (const element of pages.home.querySelectorAll('img, a[href], script[src], link[href]')) {
  if (element.tagName === 'IMG') assert.ok(element.hasAttribute('alt'), 'Every image needs alt text, including empty decorative alt')
  const value = element.getAttribute('src') ?? element.getAttribute('href')
  if (!value || value.startsWith('#')) continue
  const url = new URL(value, canonical)
  if (url.origin !== new URL(canonical).origin) continue
  assert.ok(url.pathname.startsWith(base), `Link escapes project: ${value}`)
  if (url.hash && url.pathname === base) assert.ok(pages.home.getElementById(url.hash.slice(1)))
  urls.add(url.pathname)
}
urls.add(`${base}brand/svoya-social.jpg`)
for (const url of urls) {
  const path = `dist/${url.slice(base.length)}${url.endsWith('/') ? 'index.html' : ''}`
  assert.ok((await stat(path)).isFile(), `Missing local resource: ${path}`)
}
const sitemap = new JSDOM(await readFile('dist/sitemap.xml', 'utf8'), {contentType:'application/xml'}).window.document
assert.deepEqual([...sitemap.querySelectorAll('loc')].map(node=>node.textContent), [canonical])
assert.ok((await stat('dist/svoya-coffee-1536.webp')).size < 150_000)
console.log('SEO verified: non-JS content, linked JSON-LD, metadata, private routes, sitemap and local assets.')
