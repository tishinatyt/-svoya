declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

export function analyticsEnabled() {
  return Boolean(measurementId && /^G-[A-Z0-9]+$/i.test(measurementId))
}

export function initializeAnalytics() {
  if (!analyticsEnabled() || window.gtag) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args)
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId!)}`
  document.head.appendChild(script)

  window.gtag('js', new Date())
  window.gtag('config', measurementId!, {
    send_page_view: false,
    anonymize_ip: true,
  })
}

export function trackPageView(path: string) {
  if (!analyticsEnabled() || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export function trackEvent(name: string, parameters: Record<string, string | number | boolean | null | undefined> = {}) {
  if (!analyticsEnabled() || !window.gtag) return
  window.gtag('event', name, parameters)
}
