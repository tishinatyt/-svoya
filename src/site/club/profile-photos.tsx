'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Camera,ChevronLeft,ChevronRight,ImagePlus,Star,Trash2,UserRound} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {clubDb} from '@/lib/club-db';
import type {Profile} from '@/lib/club-types';
export const PHOTO_BUCKET='svoya-profile-photos';
export function newPhotoId(){const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
export type PhotoDraft={key:string;path?:string;file?:Blob;preview?:string};
export type ProfileValues={name:string;city:string;bio:string;interests:string[]};
const signedCache=new Map<string,{url:string;expires:number}>();
function usePhotos(paths:string[]){
 const key=paths.join('|');const [urls,setUrls]=useState<Record<string,string>>({});const [failed,setFailed]=useState(false);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setFailed(false);const current=key?key.split('|'):[];
  async function sign(){const result:Record<string,string>={};const missing=current.filter(p=>{const c=signedCache.get(p);if(c&&c.expires>Date.now()){result[p]=c.url;return false;}return true;});
   if(missing.length){const {data,error}=await clubDb().storage.from(PHOTO_BUCKET).createSignedUrls(missing,900);if(error){if(active)setFailed(true);}else for(const item of data??[]){if(item.path&&item.signedUrl&&!item.error){result[item.path]=item.signedUrl;signedCache.set(item.path,{url:item.signedUrl,expires:Date.now()+12*60*1000});}else if(active)setFailed(true);}}
   if(active)setUrls(result);
  }void sign();const timer=setTimeout(()=>setRefresh(x=>x+1),12*60*1000);return()=>{active=false;clearTimeout(timer);};
 },[key,refresh]);return {urls,failed,retry:()=>setRefresh(x=>x+1)};
}
export function MemberAvatar({profile,large=false}:{profile?:Profile|null;large?:boolean}){
 const path=profile?.photo_paths?.[0];const {urls}=usePhotos(path?[path]:[]);
 return <span className={`sv-avatar${large?' sv-large-avatar':''}`}>{path&&urls[path]?<img src={urls[path]} alt={`Фото ${profile?.name}`} loading="lazy"/>:profile?.name?.[0]??<UserRound size={19}/>}</span>;
}
export function ProfileGallery({profile,onEdit}:{profile:Profile;onEdit?:()=>void}){
 const paths=profile.photo_paths??[];const {urls,failed,retry}=usePhotos(paths);const [selected,setSelected]=useState<number|null>(null);
 useEffect(()=>setSelected(null),[profile.id,paths.join('|')]);
 return <section className="sv-gallery-section"><div className="sv-gallery-heading"><div><p className="sv-overline">БЛИЖЧЕ ДО ТЕБЕ</p><h3>Фото <span>{paths.length} / 10</span></h3></div>{onEdit&&<button className="sv-outline" onClick={onEdit}><ImagePlus size={17}/>Керувати фото</button>}</div>
 {paths.length?<div className="sv-photo-gallery">{paths.map((path,i)=><button key={path} onClick={()=>setSelected(i)} aria-label={`Відкрити фото ${i+1}`} className={i===0?'is-cover':''}>{urls[path]?<img src={urls[path]} alt={`Фото ${i+1} — ${profile.name}`} loading="lazy"/>:<Camera/>}{i===0&&<span>Головне фото</span>}</button>)}</div>:<div className="sv-photo-required"><Camera size={26}/><p>Додай фото, щоб учасниці впізнали тебе на зустрічі.</p>{onEdit&&<button className="sv-btn" onClick={onEdit}>Додати обов’язкове фото</button>}</div>}
 {failed&&<p className="sv-photo-error" role="alert">Не вдалося завантажити фото. <button onClick={retry}>Повторити</button></p>}
 <Dialog open={selected!==null} onOpenChange={v=>!v&&setSelected(null)}><DialogContent className="sv-dialog sv-lightbox"><DialogTitle>{profile.name} · фото {(selected??0)+1} з {paths.length}</DialogTitle><DialogDescription>Фотогалерея учасниці</DialogDescription>{selected!==null&&<><div className="sv-lightbox-image">{urls[paths[selected]]?<img src={urls[paths[selected]]} alt={`Фото ${selected+1} — ${profile.name}`}/>:<p>Фото завантажується…</p>}</div>{paths.length>1&&<div className="sv-lightbox-controls"><button className="sv-outline" onClick={()=>setSelected((selected+paths.length-1)%paths.length)}><ChevronLeft size={18}/>Попереднє</button><span>{selected+1} / {paths.length}</span><button className="sv-outline" onClick={()=>setSelected((selected+1)%paths.length)}>Наступне<ChevronRight size={18}/></button></div>}</>}</DialogContent></Dialog>
 </section>;
}
async function preparePhoto(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Обери фото у форматі JPG, PNG або WebP.');
 if(file.size>12*1024*1024)throw new Error('Оригінал фото має бути не більшим за 12 МБ.');
 const local=URL.createObjectURL(file);try{
 const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Не вдалося прочитати фото. Обери інший файл.'));i.src=local;});
 if(image.naturalWidth<160||image.naturalHeight<160)throw new Error('Фото замале. Мінімальний розмір — 160 × 160 пікселів.');
 const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Браузер не може обробити фото.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не вдалося підготувати фото.')),'image/webp',.86));if(blob.size>6*1024*1024)throw new Error('Фото завелике. Обери інший файл.');return blob;
 }finally{URL.revokeObjectURL(local);}
}
export function ProfileEditor({profile,city,busy,onSave}:{profile:Profile|null;city:string;busy:boolean;onSave:(values:ProfileValues,photos:PhotoDraft[],accepted:boolean)=>Promise<void>}){
 const [photos,setPhotos]=useState<PhotoDraft[]>(()=> (profile?.photo_paths??[]).map(path=>({key:path,path})));
 const [interests,setInterests]=useState(profile?.interests??[]);const [accepted,setAccepted]=useState(false);const [preparing,setPreparing]=useState(false);const [error,setError]=useState('');
 const {urls,failed,retry}=usePhotos(photos.flatMap(p=>p.path?[p.path]:[]));const previews=useRef<string[]>([]);const mounted=useRef(true);const picking=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;previews.current.forEach(URL.revokeObjectURL);};},[]);
 async function add(files:File[]){if(picking.current||busy)return;setError('');if(files.length+photos.length>10){setError(`Можна додати ще ${10-photos.length} фото. У профілі максимум 10.`);return;}picking.current=true;setPreparing(true);const added:PhotoDraft[]=[];
 try{for(const f of files){const blob=await preparePhoto(f);const preview=URL.createObjectURL(blob);previews.current.push(preview);added.push({key:newPhotoId(),file:blob,preview});}if(mounted.current)setPhotos(old=>[...old,...added]);}
 catch(e){added.forEach(p=>{if(p.preview)URL.revokeObjectURL(p.preview);});if(mounted.current)setError(e instanceof Error?e.message:'Не вдалося додати фото.');}
 finally{picking.current=false;if(mounted.current)setPreparing(false);}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!photos.length){setError('Додай хоча б одне фото профілю.');return;}if(!profile&&!accepted){setError('Підтвердь правила спільноти.');return;}const f=new FormData(e.currentTarget);await onSave({name:String(f.get('name')).trim(),city:String(f.get('city')).trim(),bio:String(f.get('bio')??'').trim(),interests},photos,accepted);}
 return <form className="sv-form" onSubmit={submit}><fieldset disabled={busy||preparing} className="sv-photo-fieldset"><legend>Фото профілю <span className="sv-required">обов’язково</span></legend><p className="sv-muted">Від 1 до 10 фото. Перше фото — твій аватар. Обирай знімок, на якому тебе добре видно.</p><div className="sv-photo-editor">{photos.map((p,i)=><div className="sv-photo-tile" key={p.key}><img src={p.preview??(p.path?urls[p.path]:undefined)} alt={`Фото ${i+1}`}/>{i===0&&<span className="sv-photo-primary"><Star size={12} fill="currentColor"/>Головне</span>}<div className="sv-photo-tile-actions">{i>0&&<button type="button" title="Зробити головним" aria-label={`Зробити фото ${i+1} головним`} onClick={()=>setPhotos(old=>[old[i],...old.filter((_,n)=>n!==i)])}><Star size={16}/></button>}<button type="button" title="Видалити фото" aria-label={`Видалити фото ${i+1}`} onClick={()=>setPhotos(old=>old.filter(x=>x.key!==p.key))}><Trash2 size={16}/></button></div></div>)}{photos.length<10&&<label className="sv-photo-add"><ImagePlus size={25}/><span>{preparing?'Готуємо фото…':'Додати фото'}</span><small>{photos.length} / 10</small><input aria-label="Додати фотографії профілю" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||preparing} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void add(files);}}/></label>}</div><small>JPG, PNG, WebP · до 12 МБ за файл. Фото оптимізуються перед завантаженням.</small></fieldset>
 {failed&&<p className="sv-photo-error">Не вдалося завантажити фото. <button type="button" onClick={retry}>Повторити</button></p>}{error&&<p role="alert" className="sv-photo-error">{error}</p>}
 <label>Ім’я<input name="name" autoComplete="given-name" required minLength={2} maxLength={80} defaultValue={profile?.name??''}/></label><label>Місто<input name="city" required minLength={2} maxLength={80} defaultValue={profile?.city??city}/></label><label>Кілька слів про себе<textarea name="bio" maxLength={500} defaultValue={profile?.bio??''} placeholder="Що любиш, кого хочеш зустріти, чим можеш поділитися"/></label><fieldset disabled={busy}><legend>Твої інтереси</legend><div className="sv-interest-chips">{['Спілкування','Книги','Творчість','Спорт','Б’юті','Бізнес','Подорожі','Взаємодопомога'].map(v=><button type="button" aria-pressed={interests.includes(v)} className={interests.includes(v)?'active':''} key={v} onClick={()=>setInterests(old=>old.includes(v)?old.filter(x=>x!==v):[...old,v])}>{v}</button>)}</div></fieldset>
 {!profile&&<><label className="sv-check"><Checkbox checked={accepted} disabled={busy} onCheckedChange={v=>setAccepted(v===true)}/>Мені є 18 років. Я приєднуюся до жіночої спільноти та погоджуюся поважати її учасниць і правила.</label><p className="sv-muted">Швидкий профіль працює у цьому браузері. Після виходу чи очищення даних доступ до нього не відновлюється.</p></>}
 <p className="sv-muted">Фото, ім’я, місто та опис бачать авторизовані учасниці клубу. Зміни застосуються після збереження.</p><button className="sv-btn sv-full" disabled={busy||preparing||!photos.length||(!profile&&!accepted)}>{busy?'Зберігаємо профіль…':preparing?'Готуємо фото…':profile?'Зберегти зміни':'Приєднатися до клубу'}</button></form>;
}
