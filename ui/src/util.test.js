import { expect, test } from 'vite-plus/test'
import { bytes, duration, highlight, percent, pretty, relative, shortId } from './util'

test('duration', () => {
  expect(duration(45)).toBe('45s')
  expect(duration(750)).toBe('12m30s')
  expect(duration(3600 * 4 + 300)).toBe('4h5m')
  expect(duration(86400 * 2 + 3600 * 3)).toBe('2d 3h')
})

test('relative', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')
  expect(relative('2026-01-01T11:55:00Z', now)).toBe('5m ago')
  expect(relative('2026-01-01T14:00:00Z', now)).toBe('in 2h')
  expect(relative('0001-01-01T00:00:00Z', now)).toBe('—')
  expect(relative('', now)).toBe('—')
})

test('sizes and ratios', () => {
  expect(bytes(0)).toBe('0 B')
  expect(bytes(64712)).toBe('64.7 kB')
  expect(percent(1, 4)).toBe('25.00%')
  expect(percent(1, 0)).toBe('0.00%')
  expect(shortId('13a40821-f8f1-4e48')).toBe('13a40821')
})

test('payload viewer escapes HTML and marks JSON tokens', () => {
  expect(pretty('{"a":1}')).toBe('{\n  "a": 1\n}')
  expect(pretty('not json')).toBe('not json')
  expect(highlight('{"k": "<b>", "n": -1.5, "t": true}')).toBe(
    '{<span class="k">"k"</span>: <span class="s">"&lt;b&gt;"</span>, <span class="k">"n"</span>: <span class="n">-1.5</span>, <span class="k">"t"</span>: <span class="b">true</span>}',
  )
})

test('sorting and durations', async () => {
  const { sortRows, nextSort, parseDuration } = await import('./util')
  const rows = [
    { n: 'b', v: 2 },
    { n: 'a', v: 10 },
  ]
  expect(sortRows(rows, { key: 'n', desc: false }).map((r) => r.n)).toEqual(['a', 'b'])
  expect(sortRows(rows, { key: 'v', desc: true }).map((r) => r.v)).toEqual([10, 2])
  expect(nextSort({ key: 'n', desc: false }, 'n')).toEqual({ key: 'n', desc: true })
  expect(nextSort({ key: 'n', desc: false }, 'v', true)).toEqual({ key: 'v', desc: true })
  expect(parseDuration('15m')).toBe(900)
  expect(parseDuration('1.5h')).toBe(5400)
  expect(parseDuration('3d')).toBe(259200)
  expect(parseDuration('15')).toBeNaN()
  expect(parseDuration('-1h')).toBeNaN()
})
