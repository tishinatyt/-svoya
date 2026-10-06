// Notifications only. Do not cache authenticated pages, profiles or API data.
const appScope = new URL(self.registration.scope)
const clubUrl = new URL('club/', appScope)

// The existing push service sends /club?entry=... for the original domain.
// Rebase that route to this installation's scope, preserving its query.
function notificationUrl(value) {
  let candidate
  try { candidate = new URL(value || '/club', self.location.origin) } catch { return null }
  if (candidate.origin !== appScope.origin) return null
  const allowed = ['/club', '/club/', clubUrl.pathname, clubUrl.pathname.replace(/\/$/, '')]
  if (!allowed.includes(candidate.pathname)) return null
  const target = new URL(clubUrl)
  target.search = candidate.search
  target.hash = candidate.hash
  return target
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('push', event => {
  let message = {}
  try { message = event.data?.json() ?? {} } catch {}
  const target = notificationUrl(message.url)
  event.waitUntil(self.registration.showNotification(message.title || 'СВОЯ', {
    body: message.body || 'У клубі є новини для тебе.',
    icon: new URL('svoya-icon-192.png', appScope).href,
    badge: new URL('svoya-icon-192.png', appScope).href,
    tag: message.tag || 'svoya',
    data: { url: (target || clubUrl).href },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = notificationUrl(event.notification.data?.url)
  if (!url) return
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      const current = new URL(client.url)
      if (current.origin === appScope.origin && current.pathname.startsWith(appScope.pathname)) {
        await client.navigate(url.href)
        return client.focus()
      }
    }
    return self.clients.openWindow(url.href)
  }))
})
