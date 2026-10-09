import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClubConfig, SHARED_PROJECT_REF } from '../src/lib/club-config.ts';
import { endClubSession } from '../src/lib/club-session.ts';
import { allPages, entriesByIds, containsFilter } from '../src/lib/club-queries.ts';

const local = { VITE_SVOYA_ENV: 'local', VITE_SUPABASE_URL: 'http://127.0.0.1:55421', VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' };
test('configuration isolates previews/tests from the shared database and rejects private keys', () => {
  assert.equal(resolveClubConfig(local).pushUrl, local.VITE_SUPABASE_URL + '/functions/v1/svoya-push');
  const shared = { ...local, VITE_SUPABASE_URL: `https://${SHARED_PROJECT_REF}.supabase.co` };
  for (const mode of ['local', 'test']) assert.throws(() => resolveClubConfig({ ...shared, VITE_SVOYA_ENV: mode }));
  assert.throws(() => resolveClubConfig({ ...shared, VITE_SVOYA_ENV: 'production' }, 'localhost'));
  assert.doesNotThrow(() => resolveClubConfig({ ...shared, VITE_SVOYA_ENV: 'production' }, 'tishinatyt.github.io'));
  assert.throws(() => resolveClubConfig({ ...local, VITE_SUPABASE_ANON_KEY: 'sb_secret_fixture' }));
  const jwt = (role: string) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.fixture';
  assert.throws(() => resolveClubConfig({ ...local, VITE_SUPABASE_ANON_KEY: jwt('service_role') }));
  assert.doesNotThrow(() => resolveClubConfig({ ...local, VITE_SUPABASE_ANON_KEY: jwt('anon') }));
  assert.throws(() => resolveClubConfig({}));
});
test('logout still signs out when push cleanup rejects or never finishes', async () => {
  for (const cleanup of [async () => { throw new Error('offline'); }, () => new Promise(() => {})]) {
    let signedOut = 0;
    const result = await endClubSession(cleanup, async () => { signedOut++; return { error: null }; }, 5);
    assert.equal(signedOut, 1);
    assert.equal(result.pushCleanupFailed, true);
  }
  const authFailure = new Error('auth unavailable');
  await assert.rejects(endClubSession(async () => {}, async () => ({ error: authFailure })), authFailure);
});
test('pagination preserves older memberships beyond 400 records and propagates page errors', async () => {
  const records = Array.from({ length: 1003 }, (_, i) => i);
  assert.deepEqual(await allPages(async (from, to) => ({ data: records.slice(from, to + 1), error: null })), records);
  await assert.rejects(allPages(async from => ({ data: from ? null : records.slice(0, 200), error: from ? new Error('offline') : null })), /offline/);
  await assert.rejects(allPages(async () => ({ data: [], error: null }), 0), /page size/);
});
test('deep links load their exact record without the latest-feed window and use bounded requests', async () => {
  const ids = Array.from({ length: 205 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const batches: string[][] = [];
  const db = { from: () => ({ select: () => ({ in: async (_: string, values: string[]) => { batches.push(values); return { data: values.map(id => ({ id })), error: null }; } }) }) };
  const result = await entriesByIds(db as never, [...ids, ids[0], 'bad-id', '-'.repeat(36)]);
  assert.equal(result.length, 205);
  assert.deepEqual(batches.map(b => b.length), [100, 100, 5]);
  assert.equal(result[204].id, ids[204]);
});
test('search punctuation stays inside a quoted PostgREST value', () => {
  assert.equal(containsFilter(['name'], '  Олена, ("центр")\\  '), 'name.ilike."%Олена, (\\"центр\\")\\\\%"');
});
