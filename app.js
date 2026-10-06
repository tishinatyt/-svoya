const qs=(s,c=document)=>c.querySelector(s),qsa=(s,c=document)=>[...c.querySelectorAll(s)];
const toast=qs('#toast');
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>toast.classList.remove('show'),3200)}
const menuButton=qs('#menuButton'),nav=qs('#nav');
menuButton?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))});
qsa('#nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
const portraitRail=qs('#portraitRail');
const portraitIds=[1,2,3,4,5,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,52,53];
const portraits=portraitIds.map((id,i)=>'<img loading="lazy" src="https://randomuser.me/api/portraits/women/'+id+'.jpg" alt="Ілюстративне фото учасниці '+(i+1)+'">').join('');
if(portraitRail)portraitRail.innerHTML=portraits+portraits;
qs('#railToggle')?.addEventListener('click',e=>{const paused=portraitRail.classList.toggle('paused');e.currentTarget.textContent=paused?'Продовжити':'Пауза'});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});
qsa('.motion-reveal').forEach(el=>observer.observe(el));
window.addEventListener('scroll',()=>{const d=document.documentElement;const p=(d.scrollTop/(d.scrollHeight-d.clientHeight))*100;const el=qs('#pageProgress');if(el)el.style.width=Math.min(100,p)+'%'},{passive:true});
qsa('.magnetic').forEach(btn=>{btn.addEventListener('mousemove',e=>{const r=btn.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)*.12,y=(e.clientY-r.top-r.height/2)*.16;btn.style.transform='translate('+x+'px,'+y+'px)'});btn.addEventListener('mouseleave',()=>btn.style.transform='')});
qsa('.tilt-card').forEach(card=>{card.addEventListener('mousemove',e=>{if(innerWidth<900)return;const r=card.getBoundingClientRect(),rx=((e.clientY-r.top)/r.height-.5)*-1.6,ry=((e.clientX-r.left)/r.width-.5)*1.6;card.style.transform='perspective(1100px) rotateX('+rx+'deg) rotateY('+ry+'deg)'});card.addEventListener('mouseleave',()=>card.style.transform='')});
const dialog=qs('#profileDialog'),form=qs('#profileForm'),gallery=qs('#galleryPhotos'),galleryHint=qs('#galleryHint'),formMessage=qs('#formMessage');
function openProfile(){dialog.showModal();document.body.classList.add('modal-open')}
function closeProfile(){dialog.close();document.body.classList.remove('modal-open')}
qsa('[data-open-profile]').forEach(b=>b.addEventListener('click',openProfile));
qsa('[data-close-profile]').forEach(b=>b.addEventListener('click',closeProfile));
dialog?.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeProfile()});
gallery?.addEventListener('change',()=>{const n=gallery.files.length;if(n>10){gallery.value='';galleryHint.textContent='Максимум 10 фото';showToast('У галерею можна додати максимум 10 фото.');return}galleryHint.textContent=n+' / 10 фото'});
form?.addEventListener('submit',e=>{e.preventDefault();const mainPhoto=qs('#mainPhoto');if(!mainPhoto?.files?.length){formMessage.textContent='Додайте основне фото — воно обов’язкове.';return}if(gallery.files.length>10){formMessage.textContent='У галереї може бути максимум 10 фото.';return}const fd=new FormData(form);const profile={name:fd.get('name'),city:fd.get('city'),about:fd.get('about'),interests:fd.getAll('interests'),galleryCount:gallery.files.length,updatedAt:new Date().toISOString()};localStorage.setItem('svoyaProfile',JSON.stringify(profile));formMessage.textContent='Профіль збережено на цьому пристрої.';showToast('Профіль СВОЯ збережено.');setTimeout(closeProfile,700)});
qsa('[data-event]').forEach(btn=>btn.addEventListener('click',()=>{const eventName=btn.dataset.event;localStorage.setItem('svoyaSelectedEvent',eventName);showToast('Обрано: '+eventName+'. Створіть профіль, щоб подати заявку.');setTimeout(openProfile,450)}));
qs('#notifyButton')?.addEventListener('click',async()=>{if(!('Notification'in window)){showToast('Цей браузер не підтримує сповіщення.');return}const p=await Notification.requestPermission();if(p==='granted'){new Notification('СВОЯ',{body:'Сповіщення увімкнено. Тут з’являтимуться нові події клубу.'});showToast('Сповіщення увімкнено.')}else showToast('Дозвіл на сповіщення не надано.')});
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}