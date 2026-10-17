import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

const base = `/${(process.env.VITE_BASE_PATH || '/-svoya/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')
// Keep the temporary server bundle beside node_modules so external imports resolve.
await mkdir('node_modules/.cache', { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.cache/svoya-prerender-'))
try {
  await build({
    logLevel: 'warn',
    build: {
      ssr: resolve('src/entry-prerender.tsx'), outDir: temp,
      emptyOutDir: true, copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: 'entry.mjs' } },
    },
  })
  const { renderHome, seoHead, seoMetadata } = await import(pathToFileURL(`${temp}/entry.mjs`).href)
  const shell = await readFile('dist/index.html', 'utf8')
  const head = page => shell.replace(/<!-- svoya:seo:start -->[\s\S]*?<!-- svoya:seo:end -->/, seoHead(page, base))
  const home = head('home').replace('<div id="root"></div>', `<div id="root" data-prerendered="home">${renderHome()}</div>`)
  await writeFile('dist/index.html', home)
  await mkdir('dist/club', { recursive: true })
  await writeFile('dist/club/index.html', head('club').replace('</body>', `<noscript><p>Для спілкування у клубі увімкни JavaScript. <a href="${base}">Про СВОЯ</a></p></noscript></body>`))
  // A real 404 stays a 404. Do not redirect arbitrary URLs into an indexable app shell.
  const notFound = await readFile('public/404.html', 'utf8')
  await writeFile('dist/404.html', notFound.replace('<!-- svoya:404:seo -->', seoHead('not-found', base)).replaceAll('__SVOYA_BASE__', base))
  const { home: canonical } = seoMetadata('home', base)
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}</loc></url></urlset>\n`)
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
  manifest.id = `${base}club/`; manifest.start_url = `${base}club/`; manifest.scope = base
  manifest.icons = manifest.icons.map(icon => ({ ...icon, src: base + icon.src.replace(/^\//, '') }))
  await writeFile('dist/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n')
  await writeFile('dist/.nojekyll', '')
  console.log(`GitHub Pages ready: prerendered ${base}, private ${base}club/, genuine 404`)
} finally { await rm(temp, { recursive: true, force: true }) }
await import('./verify-seo.mjs')
