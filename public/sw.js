// Upgrade the previous GitHub Pages worker at its existing URL.
// Keep this entrypoint so browsers with the old cached shell can update.
importScripts(new URL('svoya-sw.js', self.location.href).href)
