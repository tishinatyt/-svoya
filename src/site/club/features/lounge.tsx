import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, MessageCircle, RefreshCw, Send, Trash2 } from 'lucide-react';
import { clubDb } from '@/lib/club-db';
import type { Profile } from '@/lib/club-types';
import { MemberAvatar, newPhotoId } from '../profile-photos';

type ChatMessage = { id: string; user_id: string; body: string; created_at: string };
type Author = Pick<Profile, 'id' | 'name' | 'photo_paths'>;
type Props = {
  profile: Profile | null; loading: boolean; admin: boolean;
  onLogin: () => void; onProfile: () => void; onPerson: (id: string) => void;
};
const PAGE_SIZE = 100;
const fields = 'id,user_id,body,created_at';
const dateLabel = (date: string) => new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const timeLabel = (date: string) => new Date(date).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
const sortMessages = (rows: ChatMessage[]) => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

export default function Lounge({ profile, loading, admin, onLogin, onProfile, onPerson }: Props) {
  const approved = profile?.membership_status === 'approved' && !!profile.photo_paths.length;
  return <section className="sv-lounge" aria-labelledby="sv-lounge-title">
    <header className="sv-page-heading sv-lounge-heading">
      <div><h1 id="sv-lounge-title">Теревеньки</h1><p>Спільний чат СВОЯ. Про все, чим хочеться поділитися.</p></div>
      <span className="sv-lounge-label"><MessageCircle size={16} />Усі міста</span>
    </header>
    {approved ? <Conversation key={profile.id} profile={profile} admin={admin} onPerson={onPerson} /> :
      <div className="sv-lounge-gate">
        <span className="sv-lounge-emblem"><MessageCircle size={28} strokeWidth={1.5} /></span>
        <h2>{loading ? 'Завантажуємо чат…' : profile?.membership_status === 'suspended' ? 'Доступ до клубу призупинено' : profile ? 'Спершу познайомимося' : 'Розмова починається з «привіт»'}</h2>
        <p>{loading ? 'Перевіряємо твій профіль.' : profile?.membership_status === 'suspended' ? 'Переглянь статус своєї анкети у профілі.' : profile?.membership_status === 'pending' ? 'Твоя анкета на перевірці. Після схвалення тут можна буде читати й писати повідомлення.' : profile ? 'Заповни анкету та додай фото. Чат доступний після схвалення анкети клубом.' : 'Увійди до клубу, щоб спілкуватися з учасницями. Повідомлення бачать лише учасниці зі схваленою анкетою.'}</p>
        {!loading && <button className="sv-btn" onClick={profile ? onProfile : onLogin}>{profile ? 'Мій профіль' : 'Увійти в клуб'}</button>}
      </div>}
  </section>;
}

function Conversation({ profile, admin, onPerson }: Pick<Props, 'admin' | 'onPerson'> & { profile: Profile }) {
  const db = clubDb();
  const [rows, setRows] = useState<ChatMessage[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({ [profile.id]: profile });
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newMessages, setNewMessages] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const sendLock = useRef(false);
  const deleteLock = useRef(false);
  const mutation = useRef(0);
  const attempt = useRef<{ id: string; body: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const lastMessage = useRef<string | undefined>(undefined);
  const jumpToBottom = useCallback(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottom.current = true;
    setNewMessages(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true, inFlight = false;
    async function read() {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      const version = mutation.current;
      try {
        const result = await db.from('svoya_lounge_messages').select(fields)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
        if (result.error) throw result.error;
        const messages: ChatMessage[] = result.data ?? [];
        const ids = [...new Set(messages.map(m => m.user_id))];
        const people = ids.length ? await db.from('svoya_profiles').select('id,name,photo_paths').in('id', ids) : { data: [], error: null };
        if (people.error) throw people.error;
        if (active && version === mutation.current) {
          // Replace the window so deleted messages and blocked members disappear too.
          setRows(sortMessages(messages));
          setAuthors(Object.fromEntries((people.data ?? []).map(p => [p.id, p])));
          setReadError('');
        }
      } catch {
        if (active) {
          // Do not keep a private conversation visible after an access/network error.
          setRows([]);
          setAuthors({});
          setReadError('Не вдалося завантажити чат. Перевір з’єднання та спробуй ще раз.');
        }
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    const refresh = () => { void read(); };
    refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [db, retry]);

  useLayoutEffect(() => {
    const latest = rows.at(-1)?.id;
    if (nearBottom.current) jumpToBottom();
    else if (latest && latest !== lastMessage.current) setNewMessages(true);
    lastMessage.current = latest;
  }, [rows, jumpToBottom]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || body.length > 2000 || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setActionError('');
    mutation.current++;
    // Retrying an uncertain response reuses the same ID, avoiding duplicate posts.
    if (attempt.current?.body !== body) attempt.current = { id: newPhotoId(), body };
    const id = attempt.current.id;
    try {
      let result = await db.from('svoya_lounge_messages').insert({ id, user_id: profile.id, body }).select(fields).single();
      if (result.error?.code === '23505') result = await db.from('svoya_lounge_messages').select(fields).eq('id', id).single();
      if (result.error || !result.data) throw result.error ?? new Error('Missing message');
      if (!mounted.current) return;
      nearBottom.current = true;
      setRows(old => sortMessages([...old.filter(m => m.id !== id), result.data]).slice(-PAGE_SIZE));
      setAuthors(old => ({ ...old, [profile.id]: profile }));
      setDraft('');
      attempt.current = null;
      input.current?.focus();
    } catch {
      if (mounted.current) setActionError('Повідомлення не надіслано. Текст збережено — спробуй ще раз.');
    } finally {
      mutation.current++;
      sendLock.current = false;
      if (mounted.current) { setSending(false); setRetry(n => n + 1); }
    }
  }

  async function remove(message: ChatMessage) {
    if (deleteLock.current || !window.confirm('Видалити це повідомлення?')) return;
    deleteLock.current = true;
    mutation.current++;
    setDeleting(message.id);
    setActionError('');
    try {
      const result = await db.from('svoya_lounge_messages').delete().eq('id', message.id).select('id').maybeSingle();
      if (result.error || !result.data) throw result.error ?? new Error('Not deleted');
      if (mounted.current) setRows(old => old.filter(m => m.id !== message.id));
    } catch {
      if (mounted.current) setActionError('Не вдалося видалити повідомлення. Спробуй ще раз.');
    } finally {
      mutation.current++;
      deleteLock.current = false;
      if (mounted.current) { setDeleting(null); setRetry(n => n + 1); }
    }
  }

  return <div className="sv-lounge-panel">
    <div className="sv-lounge-bar"><span>Розмови між своїми</span><small>Повідомлення оновлюються автоматично</small></div>
    <div ref={scroll} className="sv-lounge-messages" role="log" aria-label="Повідомлення Теревеньок" aria-live="polite" aria-relevant="additions text" tabIndex={0}
      onScroll={() => { const el = scroll.current!; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (nearBottom.current) setNewMessages(false); }}>
      {loading && <p className="sv-lounge-status" role="status">Завантажуємо повідомлення…</p>}
      {readError && <div className="sv-lounge-status" role="alert"><p>{readError}</p><button className="sv-outline" onClick={() => setRetry(n => n + 1)}><RefreshCw size={15} />Спробувати ще раз</button></div>}
      {!loading && !readError && !rows.length && <div className="sv-lounge-empty"><MessageCircle size={30} strokeWidth={1.5} /><h2>Тут можна просто бути собою</h2><p>Як минув день? Що надихнуло чи розсмішило?<br />Почни розмову — напиши перше «привіт».</p></div>}
      {rows.length === PAGE_SIZE && <p className="sv-lounge-window">Показуємо останні {PAGE_SIZE} повідомлень.</p>}
      {rows.map((m, i) => {
        const mine = m.user_id === profile.id, author = authors[m.user_id];
        const day = dateLabel(m.created_at);
        return <div className="sv-lounge-item" key={m.id}>
          {(i === 0 || dateLabel(rows[i - 1].created_at) !== day) && <div className="sv-lounge-date">{day}</div>}
          <article className={`sv-lounge-message${mine ? ' is-mine' : ''}`} aria-label={`${mine ? 'Ти' : author?.name ?? 'Учасниця'}, ${timeLabel(m.created_at)}`}>
            <button className="sv-lounge-avatar" aria-label={`Профіль: ${author?.name ?? 'учасниця'}`} onClick={() => onPerson(m.user_id)}><MemberAvatar profile={author} /></button>
            <div className="sv-lounge-bubble"><div className="sv-lounge-meta"><button onClick={() => onPerson(m.user_id)}>{mine ? 'Ти' : author?.name ?? 'Учасниця'}</button><time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString('uk-UA')}>{timeLabel(m.created_at)}</time></div><p>{m.body}</p>
              {(mine || admin) && <button className="sv-lounge-delete" aria-label="Видалити повідомлення" disabled={deleting === m.id} onClick={() => void remove(m)}><Trash2 size={13} />{deleting === m.id ? 'Видаляємо…' : 'Видалити'}</button>}
            </div>
          </article>
        </div>;
      })}
    </div>
    {newMessages && <button className="sv-lounge-new" onClick={jumpToBottom}><ArrowDown size={15} />Нові повідомлення</button>}
    <form className="sv-lounge-compose" onSubmit={send}>
      {actionError && <p className="sv-lounge-error" role="alert">{actionError}</p>}
      <div className="sv-lounge-compose-row"><label className="sr-only" htmlFor="sv-lounge-draft">Повідомлення в Теревеньки</label>
        <textarea id="sv-lounge-draft" ref={input} value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} rows={2} placeholder="Про що поговоримо?" disabled={sending}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
        <button className="sv-btn" type="submit" disabled={sending || !draft.trim() || loading || !!readError} aria-label={sending ? 'Надсилаємо повідомлення' : 'Надіслати повідомлення'}><Send size={18} /><span>{sending ? 'Надсилаємо…' : 'Надіслати'}</span></button>
      </div>
      <div className="sv-lounge-compose-hint"><span>З повагою та без непрошеної реклами.</span><span>{draft.length}/2000</span></div>
    </form>
  </div>;
}
