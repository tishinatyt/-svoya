/** Resolve product links and assets inside this GitHub Pages project. */
export function resolveSitePath(base: string, path = '/') {
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '')
  const route = path.replace(/^\/+/, '').replace(/^club(?=[?#]|$)/, 'club/')
  return `${prefix}/${route}`
}

export function siteUrl(path = '/') {
  return resolveSitePath(import.meta.env.BASE_URL, path)
}
