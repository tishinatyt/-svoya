import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { localStack } from '../../scripts/local-stack.mjs';

const stack = localStack();
const admin = createClient(stack.API_URL, stack.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const club = '/-svoya/club/';
const password = () => `Svoya-browser-${randomUUID()}!`;
const email = () => `svoya-browser-${randomUUID()}@example.invalid`;

test('moderator awards a title with history; member sees it without moderation rights', async ({page}, info) => {
  const fixtures=[];
  for (const label of ['Команда титулів','Учасниця титулів']) {
    const name=`${label} ${randomUUID().slice(0,8)}`;
    const address=email(), secret=password();
    const created=await admin.auth.admin.createUser({email:address,password:secret,email_confirm:true});
    expect(created.error).toBeNull();
    const id=created.data.user.id, photo=`${id}/${randomUUID()}.png`;
    expect((await admin.storage.from('svoya-profile-photos').upload(photo,await readFile(resolve('public/svoya-icon-192.png')),{contentType:'image/png'})).error).toBeNull();
    expect((await admin.from('svoya_profiles').insert({id,name,city:'Титульне місто',photo_paths:[photo],membership_status:'approved'})).error).toBeNull();
    fixtures.push({id,address,secret,name});
  }
  const [moderator,member]=fixtures;
  expect((await admin.from('svoya_admins').insert({user_id:moderator.id})).error).toBeNull();
  let dialog=await openLogin(page);
  await dialog.getByLabel('Логін або email',{exact:true}).fill(moderator.address);
  await dialog.getByLabel(/^Пароль/).fill(moderator.secret);
  await dialog.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(dialog.getByLabel('Ім’я',{exact:true})).toHaveValue(moderator.name);
  await closeDialog(page);
  await page.getByRole('button',{name:'Модерація',exact:true}).click();
  await page.getByRole('button',{name:'Титули',exact:true}).click();
  await page.getByLabel('Знайти анкету').fill(member.name);
  const card=page.locator('.sv-feature-box').filter({has:page.getByRole('heading',{name:`${member.name} · Титульне місто`,exact:true})});
  await expect(card).toHaveCount(1);
  await card.getByLabel('Титул учасниці').selectOption('inspirer');
  await expect(card.getByRole('button',{name:'Зберегти титул',exact:true})).toBeDisabled();
  await card.getByLabel('Підстава для титулу').fill('Підтверджено дві зустрічі тестового кола.');
  await card.getByRole('button',{name:'Зберегти титул',exact:true}).click();
  await expect(card.getByLabel('Титул: Графиня',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Історія титулів',exact:true}).click();
  await expect(card.locator('.sv-title-history')).toContainText('Підтверджено дві зустрічі');
  await fitsViewport(page);await capture(page,info,'title-moderation');
  await logout(page);
  dialog=await openLogin(page);
  await dialog.getByLabel('Логін або email',{exact:true}).fill(member.address);
  await dialog.getByLabel(/^Пароль/).fill(member.secret);
  await dialog.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(dialog.getByLabel('Ім’я',{exact:true})).toHaveValue(member.name);
  await closeDialog(page);
  await page.goto(`${club}?section=profile`);
  await expect(page.getByLabel('Титул: Графиня',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Модерація',exact:true})).toHaveCount(0);
  await page.getByText('Титули та як їх отримати',{exact:true}).click();
  await expect(page.locator('.sv-title-path .is-current')).toContainText('Графиня');
  await fitsViewport(page);await capture(page,info,'member-title-profile');
});

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
  await expect(dialog.getByLabel(/^Логін/)).toBeVisible();
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
  await dialog.getByLabel('Логін або email', { exact: true }).fill(address);
  await dialog.getByLabel(/^Пароль/).fill('incorrect-password');
  await dialog.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByText('Перевір логін або email і пароль.', { exact: true })).toBeVisible();
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

test('legacy email login, logout without profile and password recovery', async ({ page }) => {
  const address = email(), firstPassword = password(), nextPassword = password();
  const seeded = await admin.auth.admin.createUser({email:address,password:firstPassword,email_confirm:true});
  expect(seeded.error).toBeNull();
  let dialog = await openLogin(page);
  await dialog.getByLabel('Логін або email', {exact:true}).fill(address);
  await dialog.getByLabel(/^Пароль/).fill(firstPassword);
  await dialog.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(dialog.getByLabel('Ім’я',{exact:true})).toBeVisible();
  await closeDialog(page);
  await logout(page);
  dialog = await openLogin(page);
  await dialog.getByRole('button', { name: 'Забула пароль', exact: true }).click();
  await dialog.getByLabel('Логін або email', { exact: true }).fill(address);
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
  await dialog.getByLabel('Логін або email', { exact: true }).fill(address);
  await dialog.getByLabel(/^Пароль/).fill(nextPassword);
  await dialog.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(dialog.getByLabel('Ім’я', { exact: true })).toBeVisible();
});

test('username signup, password confirmation, duplicate protection and repeat login', async ({page}, info) => {
  const username=`qa_${randomUUID().replaceAll('-','').slice(0,16)}`, secret=password();
  await page.goto(club);
  await page.getByRole('button',{name:'Приєднатися',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Тимчасово реєструємо без email.',{exact:false})).toBeVisible();
  await expect(dialog.locator('input[type="email"]')).toHaveCount(0);
  await dialog.getByLabel(/^Логін/).fill(username);
  await dialog.getByLabel(/^Пароль/).fill(secret);
  await dialog.getByLabel('Повтори пароль',{exact:true}).fill(password());
  await dialog.getByRole('button',{name:'Створити акаунт',exact:true}).click();
  await expect(page.getByText('Паролі не збігаються. Перевір повторення.',{exact:true})).toBeVisible();
  await dialog.getByLabel('Повтори пароль',{exact:true}).fill(secret);
  await capture(page,info,'username-signup');
  await dialog.getByRole('button',{name:'Створити акаунт',exact:true}).click();
  await expect(dialog.getByLabel('Ім’я',{exact:true})).toBeVisible();
  await dialog.getByLabel('Ім’я',{exact:true}).fill('Учасниця з логіном');
  await dialog.getByLabel('Додати фотографії профілю').setInputFiles(resolve('public/svoya-icon-192.png'));
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button',{name:'Приєднатися до клубу',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`${club}?section=profile`);
  await expect(page.getByText(`Логін: ${username}`,{exact:true})).toBeVisible();
  await expect(page.getByText(/Анкета на перевірці/)).toBeVisible();
  await expect(page.getByText(/login\.svoya\.invalid/)).toHaveCount(0);
  await logout(page);
  await page.getByRole('button',{name:'Створити профіль',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByLabel(/^Логін/).fill(username.toUpperCase());
  const alternative=password();
  await dialog.getByLabel(/^Пароль/).fill(alternative);
  await dialog.getByLabel('Повтори пароль',{exact:true}).fill(alternative);
  await dialog.getByRole('button',{name:'Створити акаунт',exact:true}).click();
  await expect(page.getByText('Цей логін уже зайнятий. Обери інший або увійди до свого акаунта.',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Вхід',exact:true}).click();
  await dialog.getByLabel('Логін або email',{exact:true}).fill(username.toUpperCase());
  await dialog.getByLabel(/^Пароль/).fill(secret);
  await dialog.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(dialog.getByLabel('Ім’я',{exact:true})).toBeVisible();
  await closeDialog(page);
  await page.goto(`${club}?section=profile`);
  await expect(page.getByText(`Логін: ${username}`,{exact:true})).toBeVisible();
});
