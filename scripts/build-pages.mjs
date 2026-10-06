import { mkdir, readFile, writeFile } from 'node:fs/promises'

const base = `/${(process.env.VITE_BASE_PATH || '/-svoya/').replace(/^\/+|\/+$/g, '')}/`
const html = await readFile('dist/index.html', 'utf8')
await mkdir('dist/club', { recursive: true })
await writeFile('dist/club/index.html', html.replace('СВОЯ — жіночий клуб у Чернігові', 'СВОЯ — платформа жіночого клубу').replace('href="https://tishinatyt.github.io/-svoya/"', `href="https://tishinatyt.github.io${base}club/"`))
const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
manifest.id = `${base}club/`
manifest.start_url = `${base}club/`
manifest.scope = base
manifest.icons = manifest.icons.map(icon => ({ ...icon, src: base + icon.src.replace(/^\//, '') }))
await writeFile('dist/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n')
await writeFile('dist/404.html', `<!doctype html><html lang="uk"><meta charset="utf-8"><title>СВОЯ</title><script>location.replace(${JSON.stringify(base)}+'?__svoya_route='+encodeURIComponent(location.pathname+location.search+location.hash));</script><a href="${base}">До клубу СВОЯ</a></html>`)
await writeFile('dist/.nojekyll', '')
console.log(`GitHub Pages ready: ${base} and ${base}club/`)
