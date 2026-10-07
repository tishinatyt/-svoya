import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyMatches} from '../src/site/club/features/matching.ts';
import {eventICS} from '../src/site/club/features/calendar-utils.ts';
const me={id:'me',name:'Я',city:'Чернігів',bio:'',photo_paths:[],interests:['Книги'],availability:['weekend'],district:'Центр',discoverable:true,membership_status:'approved' as const};
test('recommendations require consent, approval and same city, explain actual matches',()=>{
 const p=(id:string,extra={})=>({...me,id,name:id,...extra});
 const rows=weeklyMatches(me,[me,p('match'),p('hidden',{discoverable:false}),p('pending',{membership_status:'pending'}),p('city',{city:'Київ'}),p('other',{interests:[],availability:[],district:''})],new Date('2026-10-07T12:00:00Z'));
 assert.deepEqual(rows.map(r=>r.profile.id),['match','other']);assert.deepEqual(rows[0].reasons,['Спільний інтерес: Книги','Вихідні','Один район: Центр']);assert.deepEqual(rows[1].reasons,['Ваше місто: Чернігів']);
});
test('recommendations stay stable within a UTC week and are capped at three',()=>{
 const people=Array.from({length:8},(_,i)=>({...me,id:String(i)}));
 assert.deepEqual(weeklyMatches(me,people,new Date('2026-10-06')),weeklyMatches(me,people,new Date('2026-10-09')));assert.equal(weeklyMatches(me,people).length,3);
});
test('calendar export handles Ukrainian, DST offsets, escaping and RFC line folding',()=>{
 const event={id:'test-id',owner_id:null,kind:'event' as const,title:'Кава, книги; друзі\\разом',description:'Рядок 1\n'+('Дуже довгий український рядок '.repeat(8)),city:'Чернігів',category:'',location:'Кафе, центр',starts_at:'2026-10-25T15:00:00+02:00',ends_at:'2026-10-25T16:00:00+02:00',capacity:4,price:0,is_demo:false,status:'published',created_at:''};
 const ics=eventICS(event,'https://example.test/club?entry=test-id',new Date('2026-10-01T00:00:00Z'));
 assert.ok(ics.includes('DTSTART:20261025T130000Z'));assert.ok(ics.includes('DTEND:20261025T140000Z'));assert.ok(ics.includes('Кава\\, книги\\; друзі\\\\разом'));assert.ok(ics.replace(/\r\n /g,'').includes('Рядок 1\\nДуже'));assert.ok(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));assert.ok(ics.endsWith('END:VCALENDAR\r\n'));assert.equal((ics.match(/BEGIN:VEVENT/g)??[]).length,1);
});
