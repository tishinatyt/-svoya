import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/-svoya/club/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'location', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let respond = async (_table: string, _calls: any[]) => ({ data: [], error: null, count: 0 });
const requests: { table: string; calls: any[] }[] = [];
function from(table: string) {
  const calls: any[] = [];
  const q = new Proxy({}, { get: (_target, name) => name === 'then'
    ? (resolve: any, reject: any) => { requests.push({ table, calls }); return respond(table, calls).then(resolve, reject); }
    : (...args: any[]) => { calls.push([name, ...args]); return q; } });
  return q;
}
mock.module('../src/lib/club-db.ts', { namedExports: { clubDb: () => ({ from }), clubConfig: () => ({}) } });
const { default: Calendar } = await import('../src/site/club/features/calendar.tsx');
const { default: Moderation } = await import('../src/site/club/features/moderation.tsx');
const { default: People } = await import('../src/site/club/features/people.tsx');
const { useCatalogue } = await import('../src/site/club/features/use-catalogue.ts');
const profile = { id: 'me', name: 'Я', city: 'Київ', interests: [], availability: [], photo_paths: [], membership_status: 'approved', discoverable: true, welcomes_newcomers: true };
const other = { ...profile, id: 'other', name: 'Олена' };
const event = { id: 'event', owner_id: 'host', kind: 'event', title: 'Майбутня зустріч', status: 'published', starts_at: '2099-01-01T12:00:00Z', city: 'Київ' };
const pause = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const container = document.getElementById('app')!;
let root: ReturnType<typeof createRoot>;
async function mount(element: React.ReactNode) { root = createRoot(container); await act(async () => { root.render(element); }); }
async function unmount() { await act(async () => root.unmount()); requests.length = 0; }
after(() => { dom.window.close(); });

test('Calendar distinguishes rejected applications from pending ones', () => {
  const html = renderToStaticMarkup(<Calendar entries={[event as never]} members={[{ entry_id: 'event', user_id: 'me', status: 'rejected' } as never]} profile={profile as never} onOpen={() => {}} />);
  assert.match(html, /Заявку відхилено/);
  assert.doesNotMatch(html, /Очікує підтвердження/);
});
test('moderation requests oldest pending profiles from the server, including entries older than 300 recent approvals', async () => {
  respond = async (table, calls) => {
    if (table !== 'svoya_profiles') return { data: [], error: null, count: 0 };
    const head = calls.some(c => c[0] === 'select' && c[2]?.head);
    const page = calls.find(c => c[0] === 'range')?.[1] ?? 0;
    return { data: head ? null : [{ ...profile, id: `old-${page}`, name: `Стара анкета ${page}`, membership_status: 'pending' }], error: null, count: 51 };
  };
  await mount(<Moderation onChange={() => {}} />);
  try {
    await act(async () => { await pause(250); });
    assert.match(container.textContent!, /Стара анкета 0/);
    assert.match(container.textContent!, /Анкети · 51/);
    const query = requests.find(r => r.calls.some(c => c[0] === 'range'))!;
    assert.ok(query.calls.some(c => c[0] === 'eq' && c[1] === 'membership_status' && c[2] === 'pending'));
    await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Наступні')!.click(); });
    await act(async () => { await pause(250); });
    assert.match(container.textContent!, /Стара анкета 50/);
  } finally { await unmount(); }
});
test('friend invitations refresh on focus and notification revision; subscriptions stop after unmount', async () => {
  let invited = false;
  respond = async (table) => ({ data: table === 'svoya_profiles' ? [profile, other] : table === 'svoya_friendships' && invited ? [{ id: 'friend', from_id: 'other', to_id: 'me', status: 'pending', note: 'Нове запрошення' }] : [], error: null });
  const element = (revision: number) => <People profile={profile as never} refreshKey={revision} onLogin={() => {}} onChange={() => {}} />;
  await mount(element(0));
  try {
    invited = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); await pause(); });
    assert.match(container.textContent!, /Нове запрошення/);
    const count = requests.filter(r => r.table === 'svoya_friendships').length;
    await act(async () => { root.render(element(1)); await pause(); });
    assert.ok(requests.filter(r => r.table === 'svoya_friendships').length > count);
  } finally { await unmount(); }
  window.dispatchEvent(new Event('focus'));
  await pause();
  assert.equal(requests.length, 0);
});
test('catalogue filters before pagination and ignores stale city responses', async () => {
  let resolveOld: any;
  respond = async (_table, calls) => {
    const city = calls.find(c => c[0] === 'eq' && c[1] === 'city')?.[2];
    if (city === 'Київ') return new Promise(resolve => { resolveOld = resolve; });
    const start = calls.find(c => c[0] === 'range')?.[1] ?? 0;
    return { data: Array.from({ length: start ? 1 : 60 }, (_, i) => ({ ...event, id: `lviv-${start + i}` })), error: null };
  };
  function Catalogue({ city }: { city: string }) {
    const data = useCatalogue('event', city, '', 'Усі', 0);
    return <><output>{data.items.map(e => e.id).join(',')}</output><button onClick={data.next} disabled={data.loading}>Далі</button></>;
  }
  await mount(<Catalogue city="Київ" />);
  try {
    await act(async () => { root.render(<Catalogue city="Львів" />); await pause(); });
    await act(async () => { resolveOld({ data: [{ ...event, id: 'stale-kyiv' }], error: null }); await pause(); });
    assert.doesNotMatch(container.textContent!, /stale-kyiv/);
    await act(async () => { container.querySelector('button')!.click(); await pause(); });
    assert.match(container.textContent!, /lviv-60/);
    const q = requests.at(-1)!.calls;
    assert.ok(q.some(c => c[0] === 'eq' && c[1] === 'city' && c[2] === 'Львів'));
    assert.ok(q.some(c => c[0] === 'eq' && c[1] === 'kind' && c[2] === 'event'));
    assert.deepEqual(q.find(c => c[0] === 'range'), ['range', 60, 119]);
  } finally { await unmount(); }
});
