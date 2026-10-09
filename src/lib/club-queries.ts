import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entry } from './club-types';
type Page<T> = { data: T[] | null; error: unknown };
export async function allPages<T>(read: (from: number, to: number) => PromiseLike<Page<T>>, size = 200): Promise<T[]> {
  const rows: T[] = [];
  if (!Number.isInteger(size) || size < 1) throw new Error('Invalid page size');
  for (let from = 0; ; from += size) {
    const r = await read(from, from + size - 1);
    if (r.error) throw r.error;
    rows.push(...(r.data ?? []));
    if (!r.data || r.data.length < size) return rows;
  }
}
export function mergeEntries(...groups: Entry[][]) {
  return [...new Map(groups.flat().map(e => [e.id, e])).values()];
}
/** Quote PostgREST values, including commas and parentheses in user input. */
export function containsFilter(columns: string[], input: string) {
  const text = input.trim().replace(/[\\"]/g, '\\$&');
  return columns.map(column => `${column}.ilike."%${text}%"`).join(',');
}
export async function entriesByIds(db: SupabaseClient, input: string[]) {
  const ids = [...new Set(input)].filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const rows: Entry[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await db.from('svoya_entries').select('*').in('id', ids.slice(i, i + 100));
    if (r.error) throw r.error;
    rows.push(...(r.data ?? []));
  }
  return rows;
}
