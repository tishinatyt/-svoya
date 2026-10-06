import {siteUrl} from '@/lib/site-path';
'use client';
import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import './portrait-strip.css';

const portraits=Array.from({length:50},(_,i)=>siteUrl(`/portraits/portrait-${String((i%5)*10+Math.floor(i/5)+1).padStart(2,'0')}.webp`));

export default function PortraitStrip(){
 const root=useRef<HTMLElement>(null);
 const [paused,setPaused]=useState(false),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const preference=()=>setReduced(media.matches);
  const visibility=()=>setHidden(document.hidden);
  preference();visibility();media.addEventListener('change',preference);document.addEventListener('visibilitychange',visibility);
  const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'120px'});
  if(root.current)observer.observe(root.current);
  return ()=>{observer.disconnect();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const running=visible&&!hidden&&!paused&&!reduced;
 return <section ref={root} className="portrait-strip" aria-labelledby="portrait-strip-title">
  <div className="portrait-strip-heading"><div><h2 id="portrait-strip-title">Своє коло починається <em>зі знайомства.</em></h2><p>Ілюстративні фото</p></div><button type="button" className="portrait-strip-toggle" onClick={()=>setPaused(v=>!v)} disabled={reduced} aria-pressed={paused||reduced} aria-label={paused?'Відновити рух фотострічки':'Призупинити рух фотострічки'}>{paused||reduced?<Play size={16}/>:<Pause size={16}/>}<span>{reduced?'Рух вимкнено':paused?'Продовжити':'Пауза'}</span></button></div>
  <div className="portrait-strip-window" role="img" aria-label="Декоративна стрічка з 50 стокових жіночих портретів">
   <div className="portrait-strip-track" style={{animationPlayState:running?'running':'paused'}} aria-hidden="true">
    {[0,1].map(copy=><div className={`portrait-strip-group ${copy?'portrait-strip-copy':''}`} key={copy}>{portraits.map(src=><div className="portrait-strip-frame" key={src}><img src={src} alt="" width={200} height={250} decoding="async" loading="eager" fetchPriority="low" draggable={false}/></div>)}</div>)}
   </div>
  </div>
 </section>;
}
