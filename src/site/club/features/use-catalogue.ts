import { useCallback, useEffect, useRef, useState } from 'react';
import { clubDb } from '@/lib/club-db';
import { containsFilter, mergeEntries } from '@/lib/club-queries';
import { labels, type Entry, type Kind } from '@/lib/club-types';

const PAGE_SIZE = 60;
export function useCatalogue(section: string, city: string, search: string, filter: string, revision: number) {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  const [term, setTerm] = useState(search);
  const cursor = useRef(0), generation = useRef(0), inFlight = useRef(false);
  useEffect(() => { const timer = setTimeout(() => setTerm(search), 200); return () => clearTimeout(timer); }, [search]);
  const enabled = section === 'feed' || section === 'calendar' || section in labels;
  const read = useCallback(async (append: boolean, ticket: number) => {
    if (!enabled || (append && inFlight.current)) return;
    inFlight.current = true; setLoading(true); setError(false);
    const from = append ? cursor.current : 0;
    try {
      const now = new Date().toISOString();
      let q = clubDb().from('svoya_entries').select('*').eq('status', 'published')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .or(`kind.neq.event,is_demo.eq.true,starts_at.is.null,starts_at.gt.${now}`);
      if (city !== 'Усі міста') q = q.eq('city', city);
      if (section === 'calendar') q = q.eq('kind', 'event').eq('is_demo', false).gt('starts_at', now);
      else if (section !== 'feed') q = q.eq('kind', section);
      if (section !== 'calendar' && filter !== 'Усі') {
        if (section === 'feed') {
          const kind = (Object.keys(labels) as Kind[]).find(k => labels[k] === filter);
          if (kind) q = q.eq('kind', kind);
        } else q = q.eq('category', filter);
      }
      if (section !== 'calendar' && term.trim()) q = q.or(containsFilter(['title', 'description', 'category'], term));
      const result = await q.order(section === 'calendar' ? 'starts_at' : 'created_at', { ascending: section === 'calendar' })
        .order('id').range(from, from + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      if (generation.current !== ticket) return;
      const rows: Entry[] = result.data ?? [];
      setItems(old => append ? mergeEntries(old, rows) : rows);
      cursor.current = from + rows.length;
      setMore(rows.length === PAGE_SIZE);
    } catch { if (generation.current === ticket) setError(true); }
    finally { if (generation.current === ticket) { inFlight.current = false; setLoading(false); } }
  }, [enabled, section, city, term, filter]);
  useEffect(() => {
    const ticket = ++generation.current;
    cursor.current = 0; inFlight.current = false; setItems([]); setMore(false); setLoading(false); setError(false);
    void read(false, ticket);
    return () => { generation.current++; };
  }, [read, revision]);
  return { items, loading, error, more, retry: () => void read(false, generation.current), next: () => void read(true, generation.current) };
}
