import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { clubDb } from '@/lib/club-db';
import type { Profile } from '@/lib/club-types';
import { memberTitles, normalizedTitle, titleKeys, type MemberTitle } from '@/lib/member-titles';
import { ErrorState, useTask } from './shared';

type Decision = {id:string; action:string; note:string; created_at:string};
export default function MemberTitleEditor({profile,onChange}: {profile:Profile;onChange:()=>void}) {
  const current=normalizedTitle(profile.member_title);
  const [next,setNext]=useState<MemberTitle>(current);
  const [reason,setReason]=useState('');
  const [showHistory,setShowHistory]=useState(false);
  const [history,setHistory]=useState<Decision[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const {busy,run}=useTask();
  useEffect(()=>{setNext(current);setReason('');},[current,profile.id]);
  useEffect(()=>{
    if (!showHistory) return;
    let active=true;setLoading(true);setError(false);
    void (async()=>{
      try {
        const r=await clubDb().from('svoya_moderation_log').select('id,action,note,created_at')
          .eq('target_id',profile.id).like('action','member_title:%').order('created_at',{ascending:false}).limit(10);
        if (r.error) throw r.error;
        if(active)setHistory(r.data??[]);
      } catch {if(active)setError(true);}
      finally {if(active)setLoading(false);}
    })();
    return ()=>{active=false;};
  },[showHistory,profile.id,current,retry]);
  return <div className="sv-title-editor">
    <form className="sv-form" onSubmit={e=>{
      e.preventDefault();
      void run(async()=>{
        const r=await clubDb().rpc('svoya_set_member_title',{target_user:profile.id,next_title:next,expected_title:current,reason:reason.trim()});
        if(r.error) {if(r.error.message.includes('SV_TITLE_CONFLICT')) onChange();throw r.error;}
        toast.success(r.data?.changed?'Титул оновлено. Учасниця отримає сповіщення.':'Цей титул уже встановлено.');
        setReason('');onChange();
      });
    }}>
      <label>Титул учасниці<select value={next} onChange={e=>setNext(e.target.value as MemberTitle)} disabled={busy}>
        {titleKeys.map(key=><option key={key} value={key}>{memberTitles[key].label}</option>)}
      </select></label>
      <p className="sv-title-criteria">{memberTitles[next].criteria}</p>
      <label>Підстава для титулу<textarea value={reason} onChange={e=>setReason(e.target.value)} required minLength={10} maxLength={1000} disabled={busy} placeholder="Які зустрічі або внесок підтверджено? Для амбасадорки — також згода учасниці." /></label>
      <small>Пояснення бачить тільки команда. Для скасування відзнаки обери «Своя» та вкажи причину.</small>
      <button className="sv-btn" disabled={busy || next===current || reason.trim().length<10}>Зберегти титул</button>
    </form>
    <button className="sv-text-button" aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>Історія титулів</button>
    {showHistory && <div aria-live="polite">
      {loading ? <p role="status">Завантажуємо історію…</p> : error ? <ErrorState retry={()=>setRetry(v=>v+1)}/> : history.length ? <ol className="sv-title-history">
        {history.map(item=><li key={item.id}><strong>{memberTitles[normalizedTitle(item.action.split(':')[2])].label}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('uk-UA')}</time><p>{item.note}</p></li>)}
      </ol> : <p className="sv-muted">Титул ще не змінювали. «Своя» з’являється після схвалення анкети.</p>}
      {!loading && !error && history.length===10 && <small>Показано останні 10 рішень. Повний журнал збережено.</small>}
    </div>}
  </div>;
}
