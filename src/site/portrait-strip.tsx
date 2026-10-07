'use client';
import {siteUrl} from '@/lib/site-path';
import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import './portrait-strip.css';

const portraitSprite=siteUrl('/portraits/illustrative-women-sprite.webp');
// Read down the five rows before moving to the next column for varied neighbours.
const portraits=Array.from({length:50},(_,i)=>({
 id:i,
 position:`${Math.floor(i/5)/9*100}% ${i%5/4*100}%`,
}));

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
  <div className="portrait-strip-heading"><div><h2 id="portrait-strip-title">Своє коло починається <em>зі знайомства.</em></h2><p>Ілюстративні портрети, створені ШІ</p></div><button type="button" className="portrait-strip-toggle" onClick={()=>setPaused(v=>!v)} disabled={reduced} aria-pressed={paused||reduced} aria-label={paused?'Відновити рух фотострічки':'Призупинити рух фотострічки'}>{paused||reduced?<Play size={16}/>:<Pause size={16}/>}<span>{reduced?'Рух вимкнено':paused?'Продовжити':'Пауза'}</span></button></div>
  <div className="portrait-strip-window" role="img" aria-label="Декоративна стрічка з 50 жіночих портретів, створених ШІ. Це ілюстрації, а не фото учасниць клубу.">
   <div className="portrait-strip-track" style={{animationPlayState:running?'running':'paused'}} aria-hidden="true">
    {[0,1].map(copy=><div className={`portrait-strip-group ${copy?'portrait-strip-copy':''}`} key={copy}>{portraits.map(({id,position})=><div className="portrait-strip-frame" key={id}><span className="portrait-strip-image" style={{backgroundImage:`url("${portraitSprite}")`,backgroundPosition:position}}/></div>)}</div>)}
   </div>
  </div>
 </section>;
}
