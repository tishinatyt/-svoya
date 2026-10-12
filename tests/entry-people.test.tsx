import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let respond = async (_ids: string[]): Promise<any> => ({ data: [], error: null });
let calls = 0;
const db = { rpc: (_name: string, {entry_ids}: {entry_ids:string[]}) => {
  const query: any = { order: () => query, range: () => query, then: (resolve: any, reject: any) => { calls++; return respond(entry_ids).then(resolve,reject); } };
  return query;
} };
mock.module('../src/lib/club-db.ts', { namedExports: { clubDb: () => db } });
mock.module('../src/site/club/profile-photos.tsx', { namedExports: { MemberAvatar: ({profile}:any) => <span>{profile.name[0]}</span> } });
const { EntryPeopleBar, useEntryPeople } = await import('../src/site/club/features/entry-people.tsx');
const people = Array.from({ length: 7 }, (_, i) => ({ entry_id:'event', user_id:`person-${i}`, name:`Учасниця ${i}`, photo_paths:[], is_host:i===0 }));
const container = document.getElementById('app')!;
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
after(() => dom.window.close());
test('card opens the selected profile, full roster, and discussion without mixing actions', async () => {
  const root = createRoot(container), actions: string[] = [];
  const props = {people,joined:6,approved:true,loading:false,error:false,onPerson:(id:string)=>actions.push(id),onMembers:()=>actions.push('members'),onChat:()=>actions.push('chat')};
  try {
    await act(async () => root.render(<EntryPeopleBar {...props}/>));
    assert.equal(container.querySelectorAll('.sv-attendee-avatar').length,4);
    assert.equal(container.querySelector('.sv-avatar-more')?.textContent,'+3');
    assert.match(container.textContent!,/Учасниці · 6/);
    await act(async () => { (container.querySelector('.sv-attendee-avatar') as HTMLElement).click(); (container.querySelector('.sv-avatar-more') as HTMLElement).click(); (container.querySelector('.sv-card-chat') as HTMLElement).click(); });
    assert.deepEqual(actions,['person-0','members','chat']);
    await act(async () => root.render(<EntryPeopleBar {...props} approved={false} people={[]}/>));
    assert.equal(container.querySelectorAll('.sv-attendee-avatar').length,0);
    assert.match(container.textContent!,/Фото після входу/);
    assert.ok(container.querySelector('.sv-card-chat'));
  } finally { await act(async () => root.unmount()); }
});
test('roster ignores stale event results, refreshes departures, clears on logout and stops requests', async () => {
  const root=createRoot(container); let oldResolve:any;
  respond=async ids => ids.includes('old') ? new Promise(resolve=>{oldResolve=resolve;}) : {data:people,error:null};
  function Fixture({id,viewer='viewer',approved=true}:{id:string;viewer?:string;approved?:boolean}) {
    const result=useEntryPeople([id],viewer,approved,0);
    return <output>{result.error ? 'error' : result.rows.map(p=>p.name).join(',')}</output>;
  }
  try {
    await act(async()=>{root.render(<Fixture id="old"/>);await pause();});
    await act(async()=>{root.render(<Fixture id="event"/>);await pause();});
    await act(async()=>{oldResolve({data:[{...people[0],name:'STALE'}],error:null});await pause();});
    assert.doesNotMatch(container.textContent!,/STALE/);assert.match(container.textContent!,/Учасниця 1/);
    respond=async()=>({data:[people[0]],error:null});
    await act(async()=>{window.dispatchEvent(new Event('focus'));await pause();});
    assert.doesNotMatch(container.textContent!,/Учасниця 1/);
    respond=async()=>({data:null,error:{message:'offline'}});
    await act(async()=>{window.dispatchEvent(new Event('focus'));await pause();});
    assert.equal(container.textContent,'error');
    await act(async()=>{root.render(<Fixture id="event" approved={false}/>);});
    assert.equal(container.textContent,'');
  } finally {await act(async()=>root.unmount());}
  const before=calls;window.dispatchEvent(new Event('focus'));await pause();assert.equal(calls,before);
});
