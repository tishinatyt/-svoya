import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import type { Profile } from '../src/lib/club-types';

const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
type Request = { table: string; method: string; payload?: any; id?: string };
let requests: Request[] = [];
let answer = async (_r: Request): Promise<any> => ({ data: [], error: null });
const db = { from(table: string) {
  const request: Request = { table, method: 'read' };
  const query: any = {
    select: () => query, order: () => query, limit: () => query, in: () => query,
    eq: (_field: string, id: string) => { request.id = id; return query; },
    insert: (payload: any) => { request.method = 'insert'; request.payload = payload; return query; },
    delete: () => { request.method = 'delete'; return query; },
    single: () => query, maybeSingle: () => query,
    then: (resolve: any, reject: any) => { requests.push(request); return answer(request).then(resolve, reject); },
  };
  return query;
} };
mock.module('../src/lib/club-db.ts', { namedExports: { clubDb: () => db } });
mock.module('../src/site/club/profile-photos.tsx', { namedExports: { MemberAvatar: ({ profile }: any) => <span>{profile?.name?.[0]}</span>, newPhotoId: () => 'retry-message-id' } });
const { default: Lounge } = await import('../src/site/club/features/lounge.tsx');
const profile: Profile = { id: 'me', name: 'Олена', city: 'Київ', bio: '', interests: [], photo_paths: ['fixture.webp'], membership_status: 'approved' };
const other = { ...profile, id: 'other', name: 'Марія' };
const message = { id: 'one', user_id: 'other', body: '<script>bad()</script> Привіт!', created_at: '2026-10-17T10:00:00Z' };
const props = { profile, loading: false, admin: false, onLogin: () => {}, onProfile: () => {}, onPerson: () => {} };
const container = document.getElementById('app')!;
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
const change = async (text: string) => { await act(async () => {
  const field = container.querySelector('textarea')!;
  Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(field, text);
  field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}); };
const submit = async () => { await act(async () => { container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await pause(); }); };
after(() => dom.window.close());

test('lounge hides chat from guests, pending, suspended and incomplete profiles without requesting messages', async () => {
  const root = createRoot(container); requests = [];
  try {
    for (const p of [null, { ...profile, membership_status: 'pending' as const }, { ...profile, membership_status: 'suspended' as const }, { ...profile, photo_paths: [] }]) {
      await act(async () => { root.render(<Lounge {...props} profile={p} />); await pause(); });
      assert.equal(container.querySelector('textarea'), null);
      assert.equal(container.querySelector('[role=log]'), null);
    }
    assert.equal(requests.length, 0);
  } finally { await act(async () => root.unmount()); }
});

test('loads authors, renders message text safely, refreshes removals and stops polling on logout', async () => {
  const root = createRoot(container); requests = [];
  answer = async r => ({ data: r.table === 'svoya_profiles' ? [other] : [message], error: null });
  try {
    await act(async () => { root.render(<Lounge {...props} />); await pause(); });
    assert.match(container.textContent!, /Марія/);
    assert.match(container.textContent!, /<script>bad\(\)<\/script>/);
    assert.equal(container.querySelector('script'), null);
    answer = async () => ({ data: [], error: null });
    await act(async () => { window.dispatchEvent(new Event('focus')); await pause(); });
    assert.doesNotMatch(container.textContent!, /bad\(\)/);
    await act(async () => { root.render(<Lounge {...props} profile={null} />); await pause(); });
    const count = requests.length;
    await act(async () => { window.dispatchEvent(new Event('focus')); await pause(); });
    assert.equal(requests.length, count);
  } finally { await act(async () => root.unmount()); }
});

test('failed sends retain text; uncertain delivery retry reuses ID and avoids duplicate posts', async () => {
  const root = createRoot(container); requests = []; let posted: any = null; let failed = false;
  answer = async r => {
    if (r.table === 'svoya_profiles') return { data: [profile], error: null };
    if (r.method === 'insert') {
      if (!failed) { posted = { ...r.payload, created_at: '2026-10-17T12:00:00Z' }; failed = true; return { data: null, error: { message: 'Network response lost' } }; }
      return { data: null, error: { code: '23505' } };
    }
    return { data: r.id ? posted : posted ? [posted] : [], error: null };
  };
  try {
    await act(async () => { root.render(<Lounge {...props} />); await pause(); });
    await change('  Привіт, свої!  ');
    await submit();
    assert.equal(container.querySelector('textarea')!.value, '  Привіт, свої!  ');
    assert.match(container.textContent!, /Текст збережено/);
    await submit();
    assert.equal(container.querySelector('textarea')!.value, '');
    const inserts = requests.filter(r => r.method === 'insert');
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0].payload.id, inserts[1].payload.id);
    assert.equal(inserts[0].payload.body, 'Привіт, свої!');
    assert.equal(container.querySelectorAll('article').length, 1);
    await change('   '); await submit();
    assert.equal(requests.filter(r => r.method === 'insert').length, 2);
  } finally { await act(async () => root.unmount()); }
});

test('late network results cannot reveal conversation after membership is revoked', async () => {
  const root = createRoot(container); let resolve: any;
  answer = r => r.table === 'svoya_profiles' ? Promise.resolve({ data: [other], error: null }) : new Promise(done => { resolve = done; });
  try {
    await act(async () => { root.render(<Lounge {...props} />); await pause(); });
    await act(async () => { root.render(<Lounge {...props} profile={{ ...profile, membership_status: 'suspended' }} />); });
    await act(async () => { resolve({ data: [message], error: null }); await pause(); });
    assert.equal(container.querySelector('article'), null);
    assert.match(container.textContent!, /призупинено/);
  } finally { await act(async () => root.unmount()); }
});
