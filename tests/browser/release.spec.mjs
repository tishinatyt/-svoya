import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { localStack } from '../../scripts/local-stack.mjs';

const stack = localStack();
const admin = createClient(stack.API_URL, stack.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const club = '/-svoya/club/';
const password = () => `Svoya-browser-${randomUUID()}!`;
const email = () => `svoya-browser-${randomUUID()}@example.invalid`;

test.beforeEach(async ({ context, page }) => {
  // Block all external traffic, including accidental calls to the shared database.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:5173', stack.API_URL].includes(url.origin)
      ? route.continue() : route.abort('blockedbyclient');
  });
  page.on('pageerror', error => { throw error; });
});

async function fitsViewport(page, locator = page.locator('html')) {
  const size = await locator.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(size.scroll, 'Content must fit without horizontal scrolling').toBeLessThanOrEqual(size.client + 1);
}
async function capture(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}
async function openLogin(page) {
  await page.goto(club);
  await page.getByRole('button', { name: 'Приєднатися', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Вхід', exact: true }).click();
  return dialog;
}
async function closeDialog(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function logout(page) {
  await page.goto(`${club}?section=profile`);
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Підтвердити' }).click();
  await expect(page.getByRole('button', { name: 'Вийти', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Створити профіль', exact: true })).toBeVisible();
}
async function localEmailLink(address, type) {
  let found;
  await expect.poll(async () => {
    const list = await (await fetch('http://127.0.0.1:55424/api/v1/messages')).json();
    for (const message of list.messages ?? []) {
      if (!message.To?.some(to => to.Address === address)) continue;
      const content = await (await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`)).json();
      for (const match of (content.HTML ?? '').matchAll(/href="([^"]+)"/g)) {
        const url = new URL(match[1].replaceAll('&amp;', '&'));
        if (url.origin === stack.API_URL && url.pathname === '/auth/v1/verify' && url.searchParams.get('type') === type) {
          found = url.href;
          return true;
        }
      }
    }
    return false;
  }, { timeout: 20_000 }).toBe(true);
  return found;
}

test('landing, club sections, guest access and dialog fit the viewport', async ({ page }, info) => {
  await page.goto('/-svoya/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Спільні плани.');
  await fitsViewport(page);
  await capture(page, info, 'landing');
  await page.getByRole('link', { name: 'Знайти своє коло', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Тут починається твоє коло.');
  await fitsViewport(page);
  await capture(page, info, 'club');
  for (const section of ['event', 'circle', 'beauty', 'business', 'help', 'calendar', 'benefits', 'stories', 'discover', 'profile']) {
    await page.goto(`${club}?section=${section}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.sv-content')).toBeVisible();
    await expect(page.locator('.sv-content')).not.toContainText('Не вдалося завантажити клуб');
    await fitsViewport(page);
  }
  await page.getByRole('button', { name: 'Створити профіль', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Email', { exact: true })).toBeVisible();
  await fitsViewport(page, dialog);
  await capture(page, info, 'auth');
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('real login, required profile photo, gallery changes and logout', async ({ page }, info) => {
  const address = email(), secret = password();
  const created = await admin.auth.admin.createUser({ email: address, password: secret, email_confirm: true });
  expect(created.error).toBeNull();
  const dialog = await openLogin(page);
  await dialog.getByLabel('Email', { exact: true }).fill(address);
  await dialog.getByLabel(/^Пароль/).fill('incorrect-password');
  await dialog.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByText('Перевір email і пароль.', { exact: true })).toBeVisible();
  await dialog.getByLabel(/^Пароль/).fill(secret);
  await dialog.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(dialog.getByLabel('Ім’я', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Приєднатися до клубу', exact: true })).toBeDisabled();
  await dialog.getByLabel('Ім’я', { exact: true }).fill('Тестова учасниця');
  await dialog.getByLabel('Додати фотографії профілю').setInputFiles([
    resolve('public/svoya-icon-192.png'), resolve('public/svoya-icon-512.png'),
  ]);
  await expect(dialog.getByRole('button', { name: 'Зробити фото 2 головним' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Зробити фото 2 головним' }).click();
  await dialog.getByRole('button', { name: 'Видалити фото 2' }).click();
  await dialog.getByRole('checkbox').check();
  await fitsViewport(page, dialog);
  await capture(page, info, 'profile-editor');
  await dialog.getByRole('button', { name: 'Приєднатися до клубу', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`${club}?section=profile`);
  await expect(page.getByText(/Анкета на перевірці/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Відкрити фото 1', exact: true })).toBeVisible();
  const saved = await admin.from('svoya_profiles').select('membership_status,photo_paths').eq('id', created.data.user.id).single();
  expect(saved.error).toBeNull();
  expect(saved.data.membership_status).toBe('pending');
  expect(saved.data.photo_paths).toHaveLength(1);
  await fitsViewport(page);
  await capture(page, info, 'profile');
  await logout(page);
});

test('signup email confirmation, logout without profile and password recovery', async ({ page }) => {
  const address = email(), firstPassword = password(), nextPassword = password();
  await page.goto(club);
  await page.getByRole('button', { name: 'Приєднатися', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill(address);
  await dialog.getByLabel(/^Пароль/).fill(firstPassword);
  await dialog.getByRole('button', { name: 'Створити акаунт', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Ми надіслали лист');
  await page.goto(await localEmailLink(address, 'signup'));
  await expect(page.getByRole('heading', { name: 'Твій профіль збережений' })).toBeVisible();
  await logout(page);
  dialog = await openLogin(page);
  await dialog.getByRole('button', { name: 'Забула пароль', exact: true }).click();
  await dialog.getByLabel('Email', { exact: true }).fill(address);
  await dialog.getByRole('button', { name: 'Відновити доступ' }).click();
  await expect(dialog.getByRole('status')).toContainText('Якщо для цього email');
  await page.goto(await localEmailLink(address, 'recovery'));
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Новий пароль/).fill(nextPassword);
  await dialog.getByRole('button', { name: 'Зберегти пароль' }).click();
  await expect(page.getByText('Пароль збережено.', { exact: true })).toBeVisible();
  await closeDialog(page);
  await logout(page);
  dialog = await openLogin(page);
  await dialog.getByLabel('Email', { exact: true }).fill(address);
  await dialog.getByLabel(/^Пароль/).fill(nextPassword);
  await dialog.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(dialog.getByLabel('Ім’я', { exact: true })).toBeVisible();
});
