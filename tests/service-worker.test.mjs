import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const code = await readFile(new URL('../public/svoya-sw.js', import.meta.url), 'utf8')
function worker() {
  const listeners = {}, shown = [], visits = []
  const context = {
    URL,
    self: {
      location: { origin: 'https://tishinatyt.github.io' },
      registration: {
        scope: 'https://tishinatyt.github.io/-svoya/',
        showNotification: async (title, options) => shown.push({ title, ...options }),
      },
      addEventListener: (name, handler) => { listeners[name] = handler },
      clients: {
        matchAll: async () => [
          { url: 'https://tishinatyt.github.io/porooch/', navigate: async url => visits.push(['poruch', url]), focus() {} },
          { url: 'https://tishinatyt.github.io/-svoya/', navigate: async url => visits.push(['svoya', url]), focus() {} },
        ],
        openWindow: async url => visits.push(['new', url]),
      },
    },
  }
  vm.runInNewContext(code, context)
  return { listeners, shown, visits }
}

test('push links and icons are rebased; notification click never navigates Poruch', async () => {
  const { listeners, shown, visits } = worker()
  let pending
  listeners.push({ data: { json: () => ({ url: '/club?entry=example&notification=notice' }) }, waitUntil: p => { pending = p } })
  await pending
  assert.equal(shown[0].icon, 'https://tishinatyt.github.io/-svoya/svoya-icon-192.png')
  assert.equal(shown[0].data.url, 'https://tishinatyt.github.io/-svoya/club/?entry=example&notification=notice')
  listeners.notificationclick({ notification: { data: shown[0].data, close() {} }, waitUntil: p => { pending = p } })
  await pending
  assert.deepEqual(visits, [['svoya', shown[0].data.url]])
})

test('notification navigation rejects other origins and other projects', () => {
  const { listeners, visits } = worker()
  for (const url of ['https://example.com/club', '/porooch/', 'javascript:alert(1)']) {
    listeners.notificationclick({ notification: { data: { url }, close() {} }, waitUntil() { assert.fail('Unsafe link accepted') } })
  }
  assert.equal(visits.length, 0)
})
