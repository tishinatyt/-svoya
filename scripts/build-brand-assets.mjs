// Optional asset preparation, requires ImageMagick. Not part of the app build.
// ImageGen removed the background; this script only crops and resizes assets.
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const source = 'public/brand/svoya-logo-transparent-source.png'
const logo = 'public/brand/svoya-logo-20261011.png'
const mark = 'public/brand/svoya-symbol-20261011.png'
const convert = (...args) => execFileSync('convert', args)

convert(source, '-crop', '1668x550+56+182', '+repage', '-strip', logo)
convert(source, '-crop', '550x550+56+182', '+repage', '-resize', '512x512', '-strip', mark)

for (const [size, destination] of [
  [32, 'public/brand/favicon-32.png'],
  [180, 'public/brand/apple-touch-icon.png'],
  [192, 'public/svoya-icon-192.png'],
  [512, 'public/svoya-icon-512.png'],
]) {
  const inner = Math.round(size * .82)
  convert(mark, '-resize', `${inner}x${inner}`, '-background', '#fbf8f2',
    '-alpha', 'remove', '-alpha', 'off', '-gravity', 'center',
    '-extent', `${size}x${size}`, '-strip', destination)
}
convert('public/svoya-icon-512.png', '-define', 'icon:auto-resize=64,48,32,16', 'public/favicon.ico')
for (const size of [192, 512]) {
  copyFileSync(`public/svoya-icon-${size}.png`, `public/icons/icon-${size}.png`)
}
for (const [size, png, svg] of [
  [32, 'public/brand/favicon-32.png', 'public/favicon.svg'],
  [192, 'public/icons/icon-192.png', 'public/icons/icon-192.svg'],
  [512, 'public/icons/icon-512.png', 'public/icons/icon-512.svg'],
]) {
  writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><title>СВОЯ — жіночий клуб</title><image width="${size}" height="${size}" href="data:image/png;base64,${readFileSync(png).toString('base64')}"/></svg>\n`)
}
console.log('Prepared approved СВОЯ logo and favicon/PWA sizes.')
