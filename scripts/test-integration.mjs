/** Destructive fixtures are restricted to the dedicated, disposable loopback stack. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStack } from './local-stack.mjs';
const stack = localStack();
const mailOrigin = new URL(stack.INBUCKET_URL ?? stack.MAILPIT_URL ?? 'http://127.0.0.1:55424').origin;
assert.equal(mailOrigin, 'http://127.0.0.1:55424');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = () => createClient(stack.API_URL, stack.ANON_KEY, options);
const admin = createClient(stack.API_URL, stack.SERVICE_ROLE_KEY, options);
function ok(result, label) { assert.equal(result.error, null, `${label}: ${result.error?.code ?? result.error?.message ?? ''}`); return result.data; }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const freshPassword = () => `Svoya-local-${randomUUID()}!`;
const emailFor = label => `svoya-${label}-${randomUUID()}@example.invalid`;
async function emailSession(email, type) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
    for (const message of list.messages ?? []) {
      if (!message.To?.some(to => to.Address === email)) continue;
      const content = await (await fetch(`${mailOrigin}/api/v1/message/${message.ID}`)).json();
      const links = [...(content.HTML ?? '').matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
      for (const link of links) {
        const url = new URL(link);
        if (url.origin !== stack.API_URL || url.pathname !== '/auth/v1/verify' || url.searchParams.get('type') !== type) continue;
        const response = await fetch(url, { redirect: 'manual' });
        assert.equal(response.status, 303, 'Local confirmation should redirect');
        const redirect = new URL(response.headers.get('location'));
        const tokens = new URLSearchParams(redirect.hash.slice(1));
        assert.ok(tokens.get('access_token'), 'Confirmation must supply a session');
        return { access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') };
      }
    }
    await sleep(250);
  }
  throw new Error(`No ${type} email reached the isolated mailbox`);
}

// No VAPID keys or devices are provisioned: fixtures cannot send real push messages.
assert.equal(ok(await admin.from('svoya_push_config').select('id'), 'Push configuration').length, 0);
const newcomer = client(), email = emailFor('email'), password = freshPassword();
const signup = ok(await newcomer.auth.signUp({ email, password }), 'Signup');
assert.equal(signup.session, null, 'Confirmation is required');
assert.ok((await newcomer.auth.signInWithPassword({ email, password })).error, 'Unconfirmed login must fail');
ok(await newcomer.auth.setSession(await emailSession(email, 'signup')), 'Confirm email');
ok(await newcomer.auth.signOut({ scope: 'local' }), 'Logout before profile');
ok(await newcomer.auth.signInWithPassword({ email, password }), 'Confirmed login');
await sleep(1100);
ok(await newcomer.auth.resetPasswordForEmail(email), 'Request recovery');
ok(await newcomer.auth.setSession(await emailSession(email, 'recovery')), 'Recovery session');
const recoveredPassword = freshPassword();
ok(await newcomer.auth.updateUser({ password: recoveredPassword }), 'Change password');
ok(await newcomer.auth.signOut({ scope: 'local' }), 'Logout after recovery');
assert.ok((await newcomer.auth.signInWithPassword({ email, password })).error, 'Old password must stop working');
ok(await newcomer.auth.signInWithPassword({ email, password: recoveredPassword }), 'Recovered login');
console.log('PASS: signup, intercepted confirmation email, login, logout without profile, intercepted recovery email and new password');

async function actor(label) {
  const email = emailFor(label), password = freshPassword(), db = client();
  ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create local fixture');
  ok(await db.auth.signInWithPassword({ email, password }), 'Fixture login');
  return db;
}
const host = await actor('host'), guest = await actor('guest'), outsider = await actor('outsider');
const actors = [host, guest, newcomer, outsider];
const ids = [], paths = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6WQAAAAASUVORK5CYII=', 'base64');
for (const db of actors) {
  const id = ok(await db.auth.getUser(), 'Read fixture identity').user.id;
  ids.push(id);
  const path = `${id}/${randomUUID()}.png`; paths.push(path);
  ok(await db.storage.from('svoya-profile-photos').upload(path, png, { contentType: 'image/png' }), 'Upload own photo');
  ok(await db.from('svoya_profiles').insert({ id, name: 'Тестова учасниця', city: 'Тестове місто', photo_paths: [path], discoverable: true, welcomes_newcomers: true }), 'Create pending profile');
  assert.ok((await db.from('svoya_profiles').update({ membership_status: 'approved' }).eq('id', id)).error, 'Self approval must fail');
}
ok(await admin.from('svoya_admins').insert({ user_id: ids[0] }), 'Local moderator');
for (const id of ids) ok(await host.rpc('svoya_community_action', { action: 'review_profile', data: { id, status: 'approved' } }), 'Server moderation');
assert.ok((await guest.storage.from('svoya-profile-photos').upload(`${ids[0]}/forged.png`, png, { contentType: 'image/png' })).error, 'Foreign photo upload must fail');
assert.ok((await guest.storage.from('svoya-profile-photos').upload(`${ids[1]}/forbidden.html`, '<script>bad</script>', { contentType: 'text/html' })).error, 'HTML upload must fail');
const foreignWrite = ok(await outsider.from('svoya_profiles').update({ bio: 'forged' }).eq('id', ids[1]).select('id'), 'Foreign profile write');
assert.equal(foreignWrite.length, 0);
console.log('PASS: real Storage upload, ownership/type checks, pending profiles, server moderation and foreign-profile write denial');

const entry = ok(await host.from('svoya_entries').insert({ owner_id: ids[0], kind: 'event', title: 'Ізольована тестова зустріч', city: 'Тестове місто', starts_at: new Date(Date.now() + 86400000).toISOString(), capacity: 2 }).select().single(), 'Create event');
for (const db of [guest, newcomer, outsider]) ok(await db.rpc('svoya_community_action', { action: 'join', data: { entry_id: entry.id, needs_greeter: true } }), 'Join event');
assert.equal(ok(await outsider.from('svoya_memberships').select('status').eq('entry_id', entry.id).eq('user_id', ids[3]).single(), 'Read waiting status').status, 'waitlisted');
ok(await host.from('svoya_memberships').update({ status: 'joined' }).eq('entry_id', entry.id).in('user_id', [ids[1], ids[2]]), 'Confirm participants');
ok(await host.rpc('svoya_community_action', { action: 'assign_greeter', data: { entry_id: entry.id, user_id: ids[2], greeter_id: ids[1] } }), 'Assign greeter');
ok(await guest.from('svoya_memberships').delete().eq('entry_id', entry.id).eq('user_id', ids[1]), 'Cancel greeter attendance');
assert.equal(ok(await newcomer.from('svoya_memberships').select('greeter_id').eq('entry_id', entry.id).eq('user_id', ids[2]).single(), 'Read repaired assignment').greeter_id, ids[0]);
assert.equal(ok(await outsider.from('svoya_memberships').select('status').eq('entry_id', entry.id).eq('user_id', ids[3]).single(), 'Read promoted status').status, 'pending');
console.log('PASS: capacity, waiting list, approval, cancellation, promotion and greeter repair through the real API');

const friendship = ok(await guest.rpc('svoya_community_action', { action: 'friend_invite', data: { user_id: ids[2] } }), 'Friend invite');
assert.ok((await guest.from('svoya_friend_messages').insert({ friendship_id: friendship.id, user_id: ids[1], body: 'Before consent' })).error);
ok(await newcomer.rpc('svoya_community_action', { action: 'friend_respond', data: { id: friendship.id, status: 'accepted' } }), 'Accept invitation');
ok(await guest.from('svoya_friend_messages').insert({ friendship_id: friendship.id, user_id: ids[1], body: 'Local fixture only' }), 'Consensual private message');
assert.equal(ok(await outsider.from('svoya_friend_messages').select('id').eq('friendship_id', friendship.id), 'Outsider chat read').length, 0);
ok(await newcomer.from('svoya_blocks').insert({ blocker_id: ids[2], blocked_id: ids[1] }), 'Block contact');
assert.equal(ok(await guest.from('svoya_friend_messages').select('id').eq('friendship_id', friendship.id), 'Blocked chat read').length, 0);
assert.ok((await guest.storage.from('svoya-profile-photos').createSignedUrl(paths[2], 60)).error, 'Blocked profile photo signing must fail');
console.log('PASS: consent-gated private chat, third-party isolation, blocking and private photo access');
// Competing real HTTP requests must not overbook the last seats.
const race = ok(await host.from('svoya_entries').insert({ owner_id: ids[0], kind: 'event', title: 'Одночасні тестові заявки', city: 'Тестове місто', starts_at: new Date(Date.now()+172800000).toISOString(), capacity: 2 }).select('id').single(), 'Create concurrent fixture');
const competitors = [guest,newcomer,outsider];
const joins = await Promise.all(competitors.map(db => db.rpc('svoya_community_action',{action:'join',data:{entry_id:race.id}})));
const statuses = joins.map(result => ok(result,'Concurrent join').status).sort();
assert.deepEqual(statuses,['pending','pending','waitlisted']);
const requests = ok(await host.from('svoya_memberships').select('user_id,status').eq('entry_id',race.id),'Read concurrent requests');
const reserved = requests.filter(row => row.status==='pending');
const waiting = requests.find(row => row.status==='waitlisted');
const cancelledIndex = ids.indexOf(reserved[0].user_id)-1;
ok(await competitors[cancelledIndex].from('svoya_memberships').delete().eq('entry_id',race.id).eq('user_id',reserved[0].user_id),'Release concurrent seat');
const afterRelease = ok(await host.from('svoya_memberships').select('user_id,status').eq('entry_id',race.id),'Read promoted concurrent requests');
assert.equal(afterRelease.filter(row => ['pending','joined'].includes(row.status)).length,2);
assert.equal(afterRelease.find(row => row.user_id===waiting.user_id).status,'pending');
console.log('PASS: simultaneous last-seat requests do not overbook, cancellation promotes the waiting applicant');
for (const db of actors) await db.auth.signOut({ scope: 'local' });
console.log('Integration fixtures remain only in the disposable local stack. Stop it after the run.');
