import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'

const root = resolve('dist'), base = '/-svoya/', origin = 'http://127.0.0.1:5182'
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.xml':'application/xml','.webmanifest':'application/manifest+json'}
const server = createServer(async(req,res)=>{
  const path = new URL(req.url, origin).pathname
  let file = path.startsWith(base) ? resolve(root, path.slice(base.length)) : ''
  if (!file.startsWith(root + '/') && file !== root) {res.writeHead(404);res.end();return}
  if (path.endsWith('/')) file += '/index.html'
  try {const body=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream'});res.end(body)}
  catch {res.writeHead(404,{'content-type':'text/html; charset=utf-8'});res.end(await readFile(root+'/404.html'))}
})
await new Promise(resolve=>server.listen(5182,'127.0.0.1',resolve))
await mkdir('test-results/seo',{recursive:true})
let browser
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']})
  const nojs=await browser.newContext({javaScriptEnabled:false})
  const staticPage=await nojs.newPage()
  await staticPage.goto(origin+base)
  assert.equal(await staticPage.locator('h1').count(),1)
  assert.ok((await staticPage.locator('main').innerText()).includes('жіночий клуб'))
  assert.ok(await staticPage.getByRole('link',{name:'Знайти своє коло',exact:true}).isVisible())
  await nojs.close()
  for (const [name,width,height] of [['desktop',1440,960],['mobile',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},locale:'uk-UA',reducedMotion:'reduce'})
    await context.route('**/*',route=>{
      const url=new URL(route.request().url())
      if(url.origin===origin)return route.continue()
      if(url.origin==='http://127.0.0.1:55421')return route.fulfill({status:200,contentType:'application/json',body:'[]',headers:{'access-control-allow-origin':'*'}})
      return route.abort()
    })
    const page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())})
    await page.goto(origin+base)
    await page.locator('.home-live-empty').waitFor()
    assert.equal(await page.locator('h1').count(),1)
    assert.ok((await page.title()).includes('жіночий клуб у Чернігові'))
    assert.equal(await page.locator('script[type="application/ld+json"]').count(),1)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    assert.ok(await page.locator('.home-hero-photo img').evaluate(img=>img.complete&&img.naturalWidth>0))
    await page.screenshot({path:`test-results/seo/home-${name}.png`,fullPage:true})
    await page.getByRole('link',{name:'Знайти своє коло',exact:true}).click()
    await page.getByRole('heading',{name:'Тут починається твоє коло.',exact:true}).waitFor()
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow')
    assert.equal(await page.locator('script[type="application/ld+json"]').count(),0)
    await page.goto(origin+base+'club/?section=lounge')
    await page.getByRole('heading',{name:'Теревеньки',exact:true}).waitFor()
    await page.goto(origin+base+'?__svoya_route='+encodeURIComponent(base+'club/?section=lounge'))
    await page.getByRole('heading',{name:'Теревеньки',exact:true}).waitFor()
    assert.equal(await page.locator('h1').count(),1)
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow')
    assert.deepEqual(errors,[],'Hydration/navigation must not introduce browser errors')
    const missing=await page.goto(origin+base+'missing-seo-check/')
    assert.equal(missing.status(),404)
    assert.equal(await page.title(),'Сторінку не знайдено — СВОЯ')
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow')
    assert.equal(page.url(),origin+base+'missing-seo-check/')
    console.log(`${name}: hydration, no-JS content, metadata, navigation and real 404 verified`)
    await context.close()
  }
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
