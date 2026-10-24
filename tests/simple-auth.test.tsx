import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/-svoya/club/' });
for (const key of ['window', 'document', 'location', 'HTMLElement', 'Event', 'MouseEvent', 'FormData']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const registrations: unknown[][] = [], logins: unknown[] = [];
const publications: Record<string, unknown>[] = [];
mock.module('../src/lib/club-login.ts', { namedExports: {
  usernameRegistration: () => true, usernameFor: () => null,
  loginAddress: (value: string) => value.includes('@') ? value : `${value}@login.svoya.invalid`,
  registerUsername: async (...args: unknown[]) => { registrations.push(args); },
} });
mock.module('../src/lib/club-db.ts', { namedExports: { clubDb: () => ({ from: () => ({ insert: (value: Record<string, unknown>) => { publications.push(value); return { select: () => ({ single: async () => ({ data: value, error: null }) }) }; } }), auth: {
  signInWithPassword: async (args: unknown) => { logins.push(args); return { error: null }; },
} }) } });
const { default: AuthPanel } = await import('../src/site/club/features/auth-panel.tsx');
after(() => dom.window.close());
test('signup needs only username/password; visibility toggle preserves input and submission signs in', async () => {
  const container = document.getElementById('app')!;
  const root = createRoot(container); let completed = 0;
  await act(async () => root.render(<AuthPanel user={null} onComplete={() => completed++} />));
  try {
    assert.deepEqual([...container.querySelectorAll('input')].map(i => i.name), ['username', 'password']);
    const username = container.querySelector<HTMLInputElement>('[name=username]')!;
    const password = container.querySelector<HTMLInputElement>('[name=password]')!;
    username.value = 'fixture_user'; password.value = 'fixture-password';
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Показати пароль')!.click());
    assert.equal(password.type, 'text'); assert.equal(password.value, 'fixture-password');
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.deepEqual(registrations, [['fixture_user', 'fixture-password', false]]);
    assert.equal(completed, 1);
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Вхід')!.click());
    assert.equal(container.querySelector<HTMLInputElement>('[name=password]')!.type, 'password');
    for (const login of ['fixture_user', 'fixture@example.invalid']) {
      container.querySelector<HTMLInputElement>('[name=email]')!.value = login;
      container.querySelector<HTMLInputElement>('[name=password]')!.value = 'fixture-password';
      await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    }
    assert.deepEqual(logins, [
      { email: 'fixture_user@login.svoya.invalid', password: 'fixture-password' },
      { email: 'fixture@example.invalid', password: 'fixture-password' },
    ]);
    assert.equal(completed, 3);
  } finally { await act(async () => root.unmount()); }
});

const { default: PublicationForm } = await import('../src/site/club/features/publication-form.tsx');
test('open format can be published; changing publication type resets its stored format', async () => {
  const container = document.getElementById('app')!; const root = createRoot(container);
  const profile = { id: 'host', city: 'Київ' };
  await act(async () => root.render(<PublicationForm profile={profile as never} initialKind="event" onPublished={() => {}} />));
  try {
    const format = [...container.querySelectorAll('select')].find(s => s.querySelector('option[value=open]'))!;
    await act(async () => { format.value = 'open'; format.dispatchEvent(new Event('change', { bubbles: true })); });
    container.querySelector<HTMLInputElement>('[name=title]')!.value = 'Відкрита зустріч';
    container.querySelector<HTMLInputElement>('[name=starts_at]')!.value = '2099-01-01T12:00';
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(publications[0]?.kind, 'event'); assert.equal(publications[0]?.format, 'open');
    assert.equal(publications[0]?.expires_at, null);
    const kind = container.querySelector('select')!;
    await act(async () => { kind.value = 'beauty'; kind.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    assert.equal(publications[1]?.kind, 'beauty'); assert.equal(publications[1]?.format, 'standard');
  } finally { await act(async () => root.unmount()); }
});
