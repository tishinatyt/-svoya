import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(root+'test-results/lounge',{recursive:true});
process.env.VITE_SVOYA_ENV='test';process.env.VITE_SUPABASE_URL='http://127.0.0.1:55421';process.env.VITE_SUPABASE_ANON_KEY='local-fixture-public-key';
const server=await createServer({root,server:{host:'127.0.0.1',port:5178,strictPort:true}});await server.listen();
let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const me={id:'00000000-0000-4000-8000-000000000001',name:'Тестова учасниця',city:'Чернігів',bio:'',photo_paths:['fixture.webp'],interests:[],membership_status:'approved'};
 const other={...me,id:'00000000-0000-4000-8000-000000000002',name:'Марія (тест)'};
 const exp=Math.floor(Date.now()/1000)+3600;
 const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:me.id,exp,role:'authenticated'})).toString('base64url')+'.local-fixture-signature';
 const session={access_token:token,refresh_token:'local-fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:me.id,aud:'authenticated',role:'authenticated',email:'fixture@local.test',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
 const baseMessages=[{id:'00000000-0000-4000-8000-000000000011',user_id:other.id,body:'Привіт! Як у вас минають вихідні? ☕',created_at:new Date(Date.now()-120000).toISOString()},{id:'00000000-0000-4000-8000-000000000012',user_id:me.id,body:'Нарешті знайшла час на прогулянку. А потім — кава й улюблена книжка 🙂',created_at:new Date(Date.now()-60000).toISOString()}];
 for(const [name,width,height] of [['desktop',1440,960],['mobile',390,844]]) {
  const context=await browser.newContext({viewport:{width,height},locale:'uk-UA',timezoneId:'Europe/Kyiv'});
  await context.addInitScript(session=>localStorage.setItem('svoya-club-auth',JSON.stringify(session)),session);
  let messages=[...baseMessages],sent=0;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='127.0.0.1'&&url.port==='5178')return route.continue();
   if(url.hostname!=='127.0.0.1'||url.port!=='55421')return route.abort();
   let data=[];const headers={'access-control-allow-origin':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   if(url.pathname.includes('/auth/v1/user'))data=session.user;
   else if(url.pathname.endsWith('/svoya_profiles')){const id=url.searchParams.get('id')??'';data=id.startsWith('eq.')?[me]:[me,other];}
   else if(url.pathname.endsWith('/svoya_lounge_messages')){
    if(req.method()==='POST'){const payload=req.postDataJSON();messages.push({...payload,created_at:new Date().toISOString()});sent++;data=messages.at(-1);}
    else data=[...messages].reverse();
   } else if(url.pathname.includes('/storage/v1/object/sign/'))data=[];
   return route.fulfill({status:200,headers,body:JSON.stringify(data)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/-svoya/club/?section=lounge');
  await page.getByText('Марія (тест)',{exact:true}).waitFor();
  assert.equal(await page.locator('.sv-lounge-message').count(),2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#sv-lounge-draft').fill('Перевірка чату');
  await page.getByRole('button',{name:'Надіслати повідомлення'}).click();
  await page.getByText('Перевірка чату',{exact:true}).waitFor();
  assert.equal(sent,1);assert.equal(await page.locator('#sv-lounge-draft').inputValue(),'');
  if(name==='mobile') {
    await page.getByRole('button',{name:'Меню',exact:true}).click();
    await page.getByRole('button',{name:'Теревеньки',exact:true}).last().click();
    await page.getByText('Марія (тест)',{exact:true}).waitFor();
  }
  await page.screenshot({path:root+'test-results/lounge/terevenky-'+name+'.png',fullPage:true});
  console.log(name,JSON.stringify({horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),messages:await page.locator('.sv-lounge-message').count(),sent,errors}));
  assert.deepEqual(errors,[]);
  await context.close();
 }
} finally {await browser?.close();await server.close();}
