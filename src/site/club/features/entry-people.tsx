import { useEffect, useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { clubDb } from '@/lib/club-db';
import { allPages } from '@/lib/club-queries';
import type { Profile } from '@/lib/club-types';
import { MemberAvatar } from '../profile-photos';

export type EntryPerson = Pick<Profile, 'name' | 'photo_paths'> & {
  entry_id: string;
  user_id: string;
  is_host: boolean;
};

export function useEntryPeople(ids: string[], viewerId: string | undefined, approved: boolean, revision: number) {
  const key = [...new Set(ids)].sort().join(',');
  const scope = `${viewerId ?? ''}:${approved}:${key}`;
  const [state, setState] = useState<{ scope: string; rows: EntryPerson[]; loading: boolean; error: boolean }>({ scope: '', rows: [], loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, inFlight = false;
    if (!approved || !viewerId || !key) return;
    async function read() {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      setState(old => ({ scope, rows: old.scope === scope ? old.rows : [], loading: true, error: false }));
      try {
        const entryIds = key.split(','), rows: EntryPerson[] = [];
        for (let i = 0; i < entryIds.length; i += 100) {
          rows.push(...await allPages<EntryPerson>((from, to) => clubDb().rpc('svoya_entry_people', { entry_ids: entryIds.slice(i, i + 100) }).order('entry_id').order('is_host', { ascending: false }).order('user_id').range(from, to)));
        }
        if (active) setState({ scope, rows, loading: false, error: false });
      } catch {
        if (active) setState({ scope, rows: [], loading: false, error: true });
      } finally { inFlight = false; }
    }
    void read();
    const refresh = () => { void read(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [scope, key, viewerId, approved, revision, retry]);
  const current = approved && viewerId && state.scope === scope;
  return {
    rows: current ? state.rows : [],
    loading: !!(approved && viewerId && key && (!current || state.loading)),
    error: !!(current && state.error),
    retry: () => setRetry(n => n + 1),
  };
}

export function EntryPeopleBar({ people, joined, approved, loading, error, onPerson, onMembers, onChat }: {
  people: EntryPerson[]; joined: number; approved: boolean; loading: boolean; error: boolean;
  onPerson: (id: string) => void; onMembers: () => void; onChat: () => void;
}) {
  const shown = people.slice(0, 4);
  return <div className="sv-card-community">
    <div className="sv-card-people">
      {approved && shown.length > 0 && <div className="sv-avatar-stack">
        {shown.map(p => <button key={p.user_id} type="button" className="sv-attendee-avatar" title={`${p.name}${p.is_host ? ' · організаторка' : ''}`} aria-label={`Профіль: ${p.name}${p.is_host ? ', організаторка' : ''}`} onClick={() => onPerson(p.user_id)}>
          <MemberAvatar profile={p} />
          {p.is_host && <span className="sv-host-dot" aria-hidden="true" />}
        </button>)}
        {people.length > shown.length && <button className="sv-avatar-more" onClick={onMembers} aria-label="Переглянути всіх учасниць">+{people.length - shown.length}</button>}
      </div>}
      <button className="sv-people-link" onClick={onMembers}>
        {!shown.length && <Users size={17} />}
        <span>Учасниці · {joined}<small>{!approved ? 'Фото після входу в клуб' : error ? 'Переглянути список' : loading && !shown.length ? 'Завантажуємо…' : joined ? 'Хто приєднався' : 'Приєднуйся першою'}</small></span>
      </button>
    </div>
    <button className="sv-card-chat" onClick={onChat}><MessageCircle size={17} />Чат</button>
  </div>;
}
