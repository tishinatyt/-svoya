import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberTitleBadge,MemberTitleGuide} from '../src/site/club/features/member-titles';
import type {Profile} from '../src/lib/club-types';
const profile:Profile={id:'fixture',name:'Fixture',city:'Чернігів',bio:'',photo_paths:[],interests:[],membership_status:'approved'};
test('title badges hide pending and suspended awards, and old profiles keep the basic title',()=>{
  assert.match(renderToStaticMarkup(<MemberTitleBadge profile={profile}/>),/Титул: Своя/);
  assert.equal(renderToStaticMarkup(<MemberTitleBadge profile={{...profile,membership_status:'pending',member_title:'ambassador'}}/>),'');
  assert.equal(renderToStaticMarkup(<MemberTitleBadge profile={{...profile,membership_status:'suspended',member_title:'inspirer'}}/>),'');
  assert.match(renderToStaticMarkup(<MemberTitleBadge profile={{...profile,member_title:'inspirer'}}/>),/Титул: Натхненниця/);
});
test('title guide explains manual verification without promising automatic attendance or admin rights',()=>{
  const html=renderToStaticMarkup(<MemberTitleGuide profile={{...profile,member_title:'active'}}/>);
  assert.match(html,/Твій титул/);assert.match(html,/трьох зустрічах/);assert.match(html,/не надає прав модерації/);assert.match(html,/погоджує її з учасницею/);
});
