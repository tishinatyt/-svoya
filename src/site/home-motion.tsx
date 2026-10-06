'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import './home-motion.css';

// Original, lightweight interpretations of Motion in Design's editorial
// reveals, photographic depth and paper-card lift. Native scrolling is kept.
export default function HomeMotion({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  let teardown=()=>{};
  function setup(){
   if(!el||reduced.matches)return ()=>{};
   const animations=new Set<Animation>();const cleanups:(()=>void)[]=[];
   const animate=(node:Element,frames:Keyframe[],delay=0,duration=850)=>{
    const a=node.animate(frames,{duration,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    animations.add(a);a.onfinish=()=>{a.cancel();animations.delete(a);};
   };
   el.classList.add('motion-enabled');
   const lines=el.querySelectorAll('.home-title-line>span');
   lines.forEach((node,i)=>animate(node,[{transform:'translateY(108%) rotate(2deg)',opacity:0},{transform:'translateY(0) rotate(0)',opacity:1}],80+i*130,1100));
   const hero=el.querySelector('.home-hero-photo');
   if(hero)animate(hero,[{clipPath:'inset(10% 6% 8% 6% round 150px 20px 20px 20px)',opacity:0},{clipPath:'inset(0% 0% 0% 0% round 0px)',opacity:1}],160,1250);
   const heroImage=el.querySelector('.home-hero-photo>img');
   if(heroImage)animate(heroImage,[{scale:'1.12'},{scale:'1.04'}],160,4000);
   el.querySelectorAll('.home-header,.home-hero .home-kicker,.home-hero-bottom,.home-round-note').forEach((node,i)=>animate(node,[{opacity:0,translate:'0 16px'},{opacity:1,translate:'0 0'}],100+i*130,850));
   // Nothing is hidden before enhancement: failed JS never hides content.
   const observer=new IntersectionObserver(items=>{for(const item of items){
    if(!item.isIntersecting)continue;const node=item.target as HTMLElement;
    const delay=Number(node.dataset.motionOrder??0)*90;
    animate(node,[{opacity:0,translate:'0 34px'},{opacity:1,translate:'0 0'}],delay,900);observer.unobserve(node);
   }},{threshold:.12});
   const groups=['.home-intro>*','.home-section-title>div','.home-section-title>p','.home-moments-grid>a','.home-world-intro','.home-paths>a','.home-steps>article','.home-final>*'];
   for(const selector of groups)el.querySelectorAll<HTMLElement>(selector).forEach((node,i)=>{node.dataset.motionOrder=String(i%5);observer.observe(node);});
   const photos=Array.from(el.querySelectorAll<HTMLElement>('.home-hero-photo,.home-moment-image'));
   const badge=el.querySelector<HTMLElement>('.home-round-note');
   const progress=el.querySelector<HTMLElement>('.home-scroll-progress');
   let frame=0;
   const paint=()=>{frame=0;if(document.hidden)return;
    const height=innerHeight;const desktop=innerWidth>700;
    for(const photo of photos){const r=photo.getBoundingClientRect();if(r.bottom<0||r.top>height)continue;
     const position=Math.max(-1,Math.min(1,(height/2-r.top-r.height/2)/(height/2+r.height/2)));
     const overscan=r.height*(photo.classList.contains('home-hero-photo')?.017:.035);
     photo.style.setProperty('--photo-shift',`${position*Math.min(desktop?24:9,overscan)}px`);
    }
    if(badge)badge.style.setProperty('--badge-turn',`${Math.min(14,scrollY*.022)-10}deg`);
    const max=document.documentElement.scrollHeight-height;
    if(progress)progress.style.transform=`scaleX(${max>0?Math.max(0,Math.min(1,scrollY/max)):0})`;
   };
   const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint);};
   addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
   const visibility=()=>{for(const a of animations){if(document.hidden)a.pause();else a.play();}schedule();};
   document.addEventListener('visibilitychange',visibility);schedule();
   const focus=(event:FocusEvent)=>{for(const a of animations){const target=(a.effect as KeyframeEffect)?.target;if(target instanceof Element&&target.contains(event.target as Node)){a.cancel();animations.delete(a);}}};
   el.addEventListener('focusin',focus);
   // Small, bounded pointer response; never moves touch targets on phones.
   if(fine.matches)el.querySelectorAll<HTMLElement>('.home-button,.home-moment-image,.home-moment-quote').forEach(node=>{
    const button=node.classList.contains('home-button');let raf=0,x=0,y=0;
    const apply=()=>{raf=0;node.style.setProperty('--pointer-x',`${x*(button?7:2.5)}${button?'px':'deg'}`);node.style.setProperty('--pointer-y',`${y*(button?5:2.5)}${button?'px':'deg'}`);};
    const move=(event:PointerEvent)=>{if(event.pointerType!=='mouse')return;const r=node.getBoundingClientRect();x=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1));y=Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1));if(!raf)raf=requestAnimationFrame(apply);};
    const reset=()=>{cancelAnimationFrame(raf);raf=0;x=0;y=0;apply();};
    node.addEventListener('pointermove',move);node.addEventListener('pointerleave',reset);node.addEventListener('blur',reset);
    cleanups.push(()=>{reset();node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',reset);node.removeEventListener('blur',reset);});
   });
   return ()=>{observer.disconnect();cancelAnimationFrame(frame);animations.forEach(a=>a.cancel());cleanups.forEach(fn=>fn());el.classList.remove('motion-enabled');photos.forEach(p=>p.style.removeProperty('--photo-shift'));badge?.style.removeProperty('--badge-turn');el.removeEventListener('focusin',focus);removeEventListener('scroll',schedule);removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',visibility);};
  }
  const refresh=()=>{teardown();teardown=setup();};refresh();reduced.addEventListener('change',refresh);fine.addEventListener('change',refresh);
  return ()=>{teardown();reduced.removeEventListener('change',refresh);fine.removeEventListener('change',refresh);};
 },[]);
 return <div className="sv-home" ref={root}><div className="home-scroll-progress" aria-hidden="true"/>{children}</div>;
}
