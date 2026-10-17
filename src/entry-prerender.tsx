import { renderToString } from 'react-dom/server'
import Home from './site/page'
export { seoHead, seoMetadata } from './lib/seo'

// Effects never run here: no database reads, user data or build-time API snapshots.
export function renderHome() { return renderToString(<Home />) }
