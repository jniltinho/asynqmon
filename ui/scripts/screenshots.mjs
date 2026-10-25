// Screenshots of every page at 2× (docs/screenshots), and a smoke test: the run fails on a console error or a
// failed request. Needs a running asynqmon with sample tasks (see the README, "Developing the UI").
//   ASYNQMON_URL=http://127.0.0.1:8080 npm run screenshots
// Uses the installed Google Chrome (PLAYWRIGHT_CHANNEL to change it).
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = (process.env.ASYNQMON_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const OUT = new URL('../../docs/screenshots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const api = async (path) => (await fetch(`${BASE}/api${path}`)).json()
const firstId = async (q, state) => (await api(`/queues/${q}/${state}_tasks?page=1&size=1`)).tasks?.[0]?.id

// the queue with the most tasks in a state
const busiest = async (state) => {
  const list = (await api('/queues')).queues.filter((q) => q[state] > 0)
  return list.sort((a, b) => b[state] - a[state])[0]?.queue
}
const completedQ = await busiest('completed')
const completedId = completedQ && (await firstId(completedQ, 'completed'))
const archivedQ = await busiest('archived')
const retryQ = await busiest('retry')

const shots = [
  ['01-dashboard', '/', 'default'],
  ['02-queue-retry', `/queues/${retryQ}?status=retry`, 'default'],
  [
    '03-queue-archived-selection',
    `/queues/${archivedQ}?status=archived`,
    'default',
    async (page) => {
      const boxes = page.locator('tbody input[type=checkbox]')
      for (const i of [0, 1, 2]) await boxes.nth(i).check()
      await page.locator('tbody button[aria-expanded]').first().click()
    },
  ],
  [
    '04-confirm-delete-all',
    `/queues/${archivedQ}?status=archived`,
    'default',
    async (page) => {
      await page.getByRole('button', { name: 'delete all' }).click()
      await page.locator('dialog[open]').waitFor()
    },
  ],
  ['05-task-completed', `/queues/${completedQ}/tasks/${completedId}`, 'default'],
  [
    '06-servers',
    '/servers',
    'default',
    async (page) => {
      await page.locator('button[aria-expanded]').first().click()
    },
  ],
  ['07-schedulers', '/schedulers', 'default'],
  ['08-redis', '/redis', 'default'],
  ['09-metrics', '/q/metrics', 'default'],
  ['10-settings', '/settings', 'default'],
  ['11-theme-classic-blue', '/', 'classic-blue'],
  ['12-theme-grafana', '/', 'grafana'],
  ['13-theme-grafana-queue', `/queues/${archivedQ}?status=archived`, 'grafana'],
  ['14-theme-rabbitmq', '/', 'rabbitmq'],
  ['15-theme-rabbitmq-queue', `/queues/${retryQ}?status=retry`, 'rabbitmq'],
  ['16-theme-graphite-metrics', '/q/metrics', 'graphite'],
]

const only = process.argv.slice(2)
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
const problems = []
for (const [name, path, theme, act] of shots) {
  if (only.length && !only.some((o) => name.includes(o))) continue
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript((t) => localStorage.setItem('asynqmon:settings', JSON.stringify({ theme: t, live: false, pageSize: 20 })), theme)
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: console: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`${name}: page error: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`${name}: request failed: ${r.url()}`))
  page.on('response', (r) => r.status() >= 400 && problems.push(`${name}: HTTP ${r.status()} ${r.url()}`))
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.locator('main [role=status]').waitFor({ state: 'detached' })
  if (act) await act(page)
  await page.waitForTimeout(400) // charts and the dialog animation settle
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log('✓', name)
  await ctx.close()
}
await browser.close()
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
