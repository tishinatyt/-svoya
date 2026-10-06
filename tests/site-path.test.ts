import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSitePath } from '../src/lib/site-path.ts'

test('Pages navigation and images stay inside the project prefix', () => {
  assert.equal(resolveSitePath('/-svoya/', '/'), '/-svoya/')
  assert.equal(resolveSitePath('/-svoya/', '/club'), '/-svoya/club/')
  assert.equal(resolveSitePath('/-svoya/', '/club?section=event&entry=123'), '/-svoya/club/?section=event&entry=123')
  assert.equal(resolveSitePath('/-svoya/', '/catalogue/coffee.webp'), '/-svoya/catalogue/coffee.webp')
  assert.equal(resolveSitePath('/-svoya/', '/portraits/portrait-50.webp'), '/-svoya/portraits/portrait-50.webp')
  assert.equal(resolveSitePath('/', '/club?section=profile'), '/club/?section=profile')
})
