const qs=(s,c=document)=>c.querySelector(s);
const qsa=(s,c=document)=>[...c.querySelectorAll(s)];

const toast=qs('#toast');
function showToast(message){
  if(!toast)return;
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(window.__svoyaToast);
  window.__svoyaToast=setTimeout(()=>toast.classList.remove('show'),3300);
}

const nav=qs('#mainNav');
const menuButton=qs('#menuButton');
menuButton?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded',String(open));
});
qsa('#mainNav a').forEach(a=>a.addEventListener('click',()=>{
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded','false');
}));

window.addEventListener('scroll',()=>{
  const d=document.documentElement;
  const max=d.scrollHeight-d.clientHeight;
  qs('#pageProgress').style.width=(max>0?Math.min(100,d.scrollTop/max*100):0)+'%';
},{passive:true});

const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
},{threshold:.12});
qsa('.reveal').forEach(el=>revealObserver.observe(el));

qsa('.magnetic').forEach(btn=>{
  btn.addEventListener('mousemove',e=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const r=btn.getBoundingClientRect();
    const x=(e.clientX-r.left-r.width/2)*.12;
    const y=(e.clientY-r.top-r.height/2)*.14;
    btn.style.transform='translate('+x+'px,'+y+'px)';
  });
  btn.addEventListener('mouseleave',()=>btn.style.transform='');
});

qsa('.tilt-card').forEach(card=>{
  card.addEventListener('mousemove',e=>{
    if(innerWidth<900||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const r=card.getBoundingClientRect();
    const rx=((e.clientY-r.top)/r.height-.5)*-2.2;
    const ry=((e.clientX-r.left)/r.width-.5)*2.2;
    card.style.transform='perspective(1100px) rotateX('+rx+'deg) rotateY('+ry+'deg)';
  });
  card.addEventListener('mouseleave',()=>card.style.transform='');
});

/* 50 portrait ribbon */
const portraitIds=[1,2,3,4,5,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,52,53];
const portraitStrip=qs('#portraitStrip');
if(portraitStrip){
  const portraits=portraitIds.map((id,i)=>'<img loading="lazy" src="https://randomuser.me/api/portraits/women/'+id+'.jpg" alt="Ілюстративний жіночий портрет '+(i+1)+'">').join('');
  portraitStrip.innerHTML=portraits+portraits;
}
qs('#portraitToggle')?.addEventListener('click',e=>{
  const paused=portraitStrip.classList.toggle('paused');
  e.currentTarget.textContent=paused?'Продовжити':'Пауза';
});

/* Notifications */
const NOTIF_KEY='svoya.notifications.v1';
function getNotifications(){
  try{return JSON.parse(localStorage.getItem(NOTIF_KEY)||'[]')}catch{return []}
}
function saveNotifications(list){localStorage.setItem(NOTIF_KEY,JSON.stringify(list))}
function addNotification(title,body){
  const list=getNotifications();
  list.unshift({id:Date.now()+Math.random(),title,body,time:new Date().toISOString(),read:false});
  saveNotifications(list.slice(0,30));
  renderNotifications();
}
function ensureWelcomeNotification(){
  const list=getNotifications();
  if(!list.length){
    saveNotifications([{id:1,title:'Ласкаво просимо до СВОЯ',body:'Тут будуть заявки, підтвердження, повідомлення та зміни подій.',time:new Date().toISOString(),read:false}]);
  }
}
function renderNotifications(){
  const list=getNotifications();
  const unread=list.filter(n=>!n.read).length;
  const count=qs('#bellCount');
  if(count){count.textContent=String(unread);count.style.display=unread?'grid':'none'}
  const box=qs('#notificationsList');
  if(!box)return;
  box.innerHTML=list.length?list.map(n=>'<div class="notification-item '+(!n.read?'unread':'')+'"><strong>'+escapeHtml(n.title)+'</strong><span>'+escapeHtml(n.body)+'</span><small>'+formatRelative(n.time)+'</small></div>').join(''):'<div class="notifications-empty">Нових сповіщень немає.</div>';
}
ensureWelcomeNotification();
renderNotifications();

const notificationsPanel=qs('#notificationsPanel');
qs('#bellButton')?.addEventListener('click',e=>{
  e.stopPropagation();
  notificationsPanel.hidden=!notificationsPanel.hidden;
});
notificationsPanel?.addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',()=>{if(notificationsPanel&&!notificationsPanel.hidden)notificationsPanel.hidden=true});
qs('#markAllRead')?.addEventListener('click',()=>{
  const list=getNotifications().map(n=>({...n,read:true}));
  saveNotifications(list);
  renderNotifications();
});
qs('#pushButton')?.addEventListener('click',async()=>{
  if(!('Notification' in window)){showToast('Цей браузер не підтримує push-сповіщення.');return}
  const permission=await Notification.requestPermission();
  if(permission==='granted'){
    addNotification('Push увімкнено','СВОЯ може показувати важливі оновлення у браузері.');
    try{new Notification('СВОЯ',{body:'Push-сповіщення увімкнено.'})}catch{}
    showToast('Push-сповіщення увімкнено.');
  }else showToast('Дозвіл на push не надано.');
});

/* IndexedDB for profile photos */
const DB_NAME='svoya-club-db';
const STORE='media';
let dbPromise;
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function dbGet(key){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function dbPut(key,value){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(value,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
async function dbDelete(key){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

const PROFILE_KEY='svoya.profile.v2';
function getProfile(){
  try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}
}
function saveProfile(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p))}
let avatarBlob=null;
let galleryItems=[];

const profileDialog=qs('#profileDialog');
const profileForm=qs('#profileForm');
const avatarPreview=qs('#avatarPreview');
const galleryBox=qs('#profileGallery');
const galleryCount=qs('#galleryCount');
const profileMessage=qs('#profileMessage');

function setBodyLock(){document.body.classList.toggle('locked',qsa('dialog[open]').length>0)}
async function loadProfileIntoForm(){
  const p=getProfile();
  if(p){
    qs('#profileName').value=p.name||'';
    qs('#profileCity').value=p.city||'Чернігів';
    qs('#profileAbout').value=p.about||'';
    qsa('.interest-chips input').forEach(i=>i.checked=(p.interests||[]).includes(i.value));
  }
  avatarBlob=await dbGet('avatar')||null;
  galleryItems=await dbGet('gallery')||[];
  renderAvatar();
  renderGallery();
}
async function openProfileDialog(message=''){
  await loadProfileIntoForm();
  profileMessage.textContent=message;
  if(typeof profileDialog.showModal==='function'&&!profileDialog.open)profileDialog.showModal();
  setBodyLock();
}
function closeProfileDialog(){
  if(profileDialog.open)profileDialog.close();
  setBodyLock();
}
qsa('[data-open-profile]').forEach(b=>b.addEventListener('click',()=>openProfileDialog()));
qsa('[data-close-profile]').forEach(b=>b.addEventListener('click',closeProfileDialog));
profileDialog?.addEventListener('click',e=>{
  const r=profileDialog.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProfileDialog();
});

function renderAvatar(){
  if(!avatarPreview)return;
  avatarPreview.innerHTML='';
  if(!avatarBlob){avatarPreview.innerHTML='<span>Фото</span>';return}
  const img=document.createElement('img');
  img.src=URL.createObjectURL(avatarBlob);
  img.alt='Основне фото профілю';
  avatarPreview.appendChild(img);
}
function renderGallery(){
  if(!galleryBox)return;
  galleryCount.textContent=galleryItems.length+' / 10';
  galleryBox.innerHTML='';
  galleryItems.forEach((item,index)=>{
    const card=document.createElement('div');
    card.className='gallery-photo';
    const img=document.createElement('img');
    img.src=URL.createObjectURL(item.blob);
    img.alt='Фото профілю '+(index+1);
    img.addEventListener('click',()=>openLargePhoto(item.blob));
    const tools=document.createElement('div');
    tools.className='gallery-tools';
    const avatarBtn=document.createElement('button');
    avatarBtn.type='button';
    avatarBtn.textContent='Аватар';
    avatarBtn.addEventListener('click',async()=>{
      avatarBlob=item.blob;
      await dbPut('avatar',avatarBlob);
      renderAvatar();
      showToast('Основне фото змінено.');
    });
    const deleteBtn=document.createElement('button');
    deleteBtn.type='button';
    deleteBtn.textContent='×';
    deleteBtn.addEventListener('click',async()=>{
      galleryItems.splice(index,1);
      await dbPut('gallery',galleryItems);
      renderGallery();
    });
    tools.append(avatarBtn,deleteBtn);
    card.append(img,tools);
    galleryBox.appendChild(card);
  });
}

qs('#mainPhotoInput')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  avatarBlob=file;
  await dbPut('avatar',avatarBlob);
  renderAvatar();
  showToast('Основне фото додано.');
  e.target.value='';
});
qs('#galleryInput')?.addEventListener('change',async e=>{
  const files=[...(e.target.files||[])];
  if(!files.length)return;
  const free=10-galleryItems.length;
  if(free<=0){showToast('У галереї вже 10 фото.');e.target.value='';return}
  if(files.length>free)showToast('Додано '+free+' фото. Максимум — 10.');
  files.slice(0,free).forEach((file,i)=>galleryItems.push({id:Date.now()+i,name:file.name,blob:file}));
  await dbPut('gallery',galleryItems);
  renderGallery();
  e.target.value='';
});

profileForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!avatarBlob){
    profileMessage.textContent='Додайте основне фото — воно обов’язкове.';
    return;
  }
  const name=qs('#profileName').value.trim();
  const city=qs('#profileCity').value.trim();
  if(!name||!city){profileMessage.textContent='Заповніть ім’я та місто.';return}
  const interests=qsa('.interest-chips input:checked').map(i=>i.value);
  saveProfile({name,city,about:qs('#profileAbout').value.trim(),interests,updatedAt:new Date().toISOString()});
  profileMessage.textContent='Профіль збережено.';
  addNotification('Профіль оновлено','Фото, місто та інтереси збережені на цьому пристрої.');
  showToast('Профіль СВОЯ збережено.');
  setTimeout(closeProfileDialog,650);
});

/* Large photo */
const photoDialog=qs('#photoDialog');
const photoLarge=qs('#photoLarge');
function openLargePhoto(blob){
  photoLarge.src=URL.createObjectURL(blob);
  if(!photoDialog.open)photoDialog.showModal();
  setBodyLock();
}
qs('#photoClose')?.addEventListener('click',()=>{photoDialog.close();setBodyLock()});

/* Event applications */
const APPLICATIONS_KEY='svoya.applications.v1';
function getApplications(){try{return JSON.parse(localStorage.getItem(APPLICATIONS_KEY)||'[]')}catch{return []}}
function saveApplications(v){localStorage.setItem(APPLICATIONS_KEY,JSON.stringify(v))}
async function applyToEvent(name){
  if(!getProfile()){
    localStorage.setItem('svoya.pendingEvent',name);
    await openProfileDialog('Спочатку створіть профіль — після збереження заявка на «'+name+'» залишиться доступною.');
    return;
  }
  const list=getApplications();
  if(!list.some(a=>a.name===name))list.push({name,status:'Заявку надіслано',createdAt:new Date().toISOString()});
  saveApplications(list);
  addNotification('Заявка на подію',name+' — заявку надіслано. Підтвердження з’явиться тут.');
  showToast('Заявку на «'+name+'» надіслано.');
  renderClub();
}
qsa('[data-apply-event]').forEach(b=>b.addEventListener('click',()=>applyToEvent(b.dataset.applyEvent)));
qsa('.catalog-item[data-event]').forEach(b=>b.addEventListener('click',()=>applyToEvent(b.dataset.event)));

/* Club modal */
const clubDialog=qs('#clubDialog');
function openClub(){
  renderClub();
  if(!clubDialog.open)clubDialog.showModal();
  setBodyLock();
}
function closeClub(){if(clubDialog.open)clubDialog.close();setBodyLock()}
qsa('[data-open-club]').forEach(b=>b.addEventListener('click',openClub));
qsa('[data-close-club]').forEach(b=>b.addEventListener('click',closeClub));
qsa('.club-tab[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  qsa('.club-tab[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
  qsa('.club-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===btn.dataset.tab));
}));

const seedFeed=[
  {img:'https://randomuser.me/api/portraits/women/32.jpg',title:'Олена шукає компанію на виставку',text:'У суботу після 15:00. Хто теж давно хотів піти?',meta:'12 хв тому'},
  {img:'https://randomuser.me/api/portraits/women/44.jpg',title:'Марина · маленький бізнес',text:'Шукаю фотографку для нової колекції. Можливо, хтось зі своїх?',meta:'38 хв тому'},
  {img:'https://randomuser.me/api/portraits/women/18.jpg',title:'Ірина · книжкове коло',text:'Обираємо наступну книгу. Додала три варіанти у чаті кола.',meta:'1 год тому'}
];
const circles=[
  {img:'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=240&q=75',title:'Книжкове коло',text:'до 8 учасниць · раз на два тижні',meta:'Приєднатися'},
  {img:'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=240&q=75',title:'Творче коло',text:'кераміка · малювання · виставки',meta:'Приєднатися'},
  {img:'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=240&q=75',title:'Прогулянки',text:'місто · природа · короткі поїздки',meta:'Приєднатися'}
];
const beauty=[
  {img:'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=240&q=75',title:'Аліна · hair',text:'стрижки · укладки · фарбування',meta:'Відкрити'},
  {img:'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=240&q=75',title:'Катерина · nails',text:'манікюр · покриття · дизайн',meta:'Відкрити'},
  {img:'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=240&q=75',title:'Наталя · догляд',text:'масаж обличчя · доглядові процедури',meta:'Відкрити'}
];
const business=[
  {img:'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=240&q=75',title:'Business circle',text:'контакти · досвід · партнерства',meta:'Долучитися'},
  {img:'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=240&q=75',title:'Розбір ідеї',text:'маленька група · чесний зворотний зв’язок',meta:'Долучитися'}
];
const defaultHelp=[
  {img:'https://randomuser.me/api/portraits/women/22.jpg',title:'Потрібен контакт майстрині',text:'Хто може порадити перевірену майстриню з ремонту одягу?',meta:'Відгукнутися'},
  {img:'https://randomuser.me/api/portraits/women/37.jpg',title:'Підвезти коробки',text:'У п’ятницю треба перевезти кілька коробок по місту.',meta:'Відгукнутися'}
];
const clubEventsSeed=[
  {img:'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=240&q=75',title:'Кава без поспіху',text:'СБ · 10:30 · Чернігів',meta:'Подати заявку'},
  {img:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=240&q=75',title:'Прогулянка містом',text:'НД · 15:00 · Центр',meta:'Подати заявку'},
  {img:'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=240&q=75',title:'Business circle',text:'СР · 18:30 · до 10 учасниць',meta:'Подати заявку'}
];

function renderCards(containerId,items,actionHandler){
  const box=qs('#'+containerId);
  if(!box)return;
  box.innerHTML=items.map((x,i)=>'<article class="compact-card"><img src="'+x.img+'" alt=""><div><h4>'+escapeHtml(x.title)+'</h4><p>'+escapeHtml(x.text)+'</p></div><button class="card-action" data-card-index="'+i+'">'+escapeHtml(x.meta)+'</button></article>').join('');
  if(actionHandler)qsa('[data-card-index]',box).forEach(b=>b.addEventListener('click',()=>actionHandler(items[Number(b.dataset.cardIndex)])));
}
function renderClub(){
  let customFeed=[];
  try{customFeed=JSON.parse(localStorage.getItem('svoya.feed.v1')||'[]')}catch{}
  const feed=[...customFeed,...seedFeed];
  const feedBox=qs('#feedList');
  if(feedBox)feedBox.innerHTML=feed.map(x=>'<article class="feed-card"><img src="'+(x.img||'https://randomuser.me/api/portraits/women/12.jpg')+'" alt=""><div><h4>'+escapeHtml(x.title)+'</h4><p>'+escapeHtml(x.text)+'</p></div><small>'+escapeHtml(x.meta||'щойно')+'</small></article>').join('');

  renderCards('clubEvents',clubEventsSeed,x=>applyToEvent(x.title));
  renderCards('circlesList',circles,x=>{addNotification('Своє коло',x.title+' — запит на приєднання збережено.');showToast('Запит на приєднання збережено.')});
  renderCards('beautyList',beauty,x=>showToast(x.title+': картка майстрині відкрита.'));
  renderCards('businessList',business,x=>{addNotification('Бізнес',x.title+' — інтерес збережено.');showToast('Додано до ваших інтересів.')});
  let customHelp=[];
  try{customHelp=JSON.parse(localStorage.getItem('svoya.help.v1')||'[]')}catch{}
  renderCards('helpList',[...customHelp,...defaultHelp],x=>showToast('Ви відгукнулися на запит: '+x.title));

  renderChat();
}
qs('#newPostButton')?.addEventListener('click',()=>{
  const text=prompt('Що хочете написати у стрічці?');
  if(!text)return;
  let feed=[];try{feed=JSON.parse(localStorage.getItem('svoya.feed.v1')||'[]')}catch{}
  const p=getProfile();
  feed.unshift({img:'https://randomuser.me/api/portraits/women/12.jpg',title:(p?.name||'Учасниця')+' · новий допис',text,meta:'щойно'});
  localStorage.setItem('svoya.feed.v1',JSON.stringify(feed.slice(0,10)));
  addNotification('Новий допис','Ваш допис опубліковано у локальній демо-стрічці.');
  renderClub();
});
qs('#newHelpButton')?.addEventListener('click',()=>{
  const text=prompt('Яка допомога потрібна?');
  if(!text)return;
  let list=[];try{list=JSON.parse(localStorage.getItem('svoya.help.v1')||'[]')}catch{}
  list.unshift({img:'https://randomuser.me/api/portraits/women/12.jpg',title:'Новий запит',text,meta:'Відгукнутися'});
  localStorage.setItem('svoya.help.v1',JSON.stringify(list.slice(0,10)));
  addNotification('Запит про допомогу','Ваш запит додано до розділу «Допомога».');
  renderClub();
});

/* Chat */
const CHAT_KEY='svoya.chat.v1';
function getChat(){
  try{
    const saved=JSON.parse(localStorage.getItem(CHAT_KEY)||'null');
    if(saved)return saved;
  }catch{}
  return [
    {text:'Привіт! Я буду на каві у суботу ☕',mine:false},
    {text:'Супер, я теж планую. Побачимося!',mine:true},
    {text:'Домовились. Деталі зустрічі вже в події.',mine:false}
  ];
}
function saveChat(v){localStorage.setItem(CHAT_KEY,JSON.stringify(v.slice(-60)))}
function renderChat(){
  const box=qs('#chatWindow');if(!box)return;
  box.innerHTML=getChat().map(m=>'<div class="chat-message '+(m.mine?'mine':'')+'">'+escapeHtml(m.text)+'</div>').join('');
  box.scrollTop=box.scrollHeight;
}
qs('#chatForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const input=qs('#chatInput');
  const text=input.value.trim();if(!text)return;
  const chat=getChat();chat.push({text,mine:true});saveChat(chat);input.value='';renderChat();
  addNotification('Нове повідомлення','Ваше повідомлення додано до чату.');
});

/* Utility */
function escapeHtml(v=''){
  return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function formatRelative(iso){
  const ms=Date.now()-new Date(iso).getTime();
  const min=Math.max(0,Math.floor(ms/60000));
  if(min<1)return'щойно';
  if(min<60)return min+' хв тому';
  const h=Math.floor(min/60);
  if(h<24)return h+' год тому';
  return new Date(iso).toLocaleDateString('uk-UA');
}

/* After a profile is saved, fulfill a pending event application */
window.addEventListener('storage',()=>{});
const originalSaveProfile=saveProfile;
saveProfile=function(p){
  originalSaveProfile(p);
  const pending=localStorage.getItem('svoya.pendingEvent');
  if(pending){
    localStorage.removeItem('svoya.pendingEvent');
    const list=getApplications();
    if(!list.some(a=>a.name===pending))list.push({name:pending,status:'Заявку надіслано',createdAt:new Date().toISOString()});
    saveApplications(list);
    addNotification('Заявка на подію',pending+' — заявку надіслано.');
  }
};

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
