// Formatting helpers of the pages (durations, sizes, payloads).
const ZERO = '0001-01-01T00:00:00Z'

export const isZeroTime = (ts) => !ts || ts === ZERO || ts.startsWith('0001-01-01')

// duration renders seconds as "2d 3h", "4h5m", "12m30s" or "45s".
export function duration(sec) {
  sec = Math.max(0, Math.floor(sec))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h${m ? `${m}m` : ''}`
  if (m) return `${m}m${s ? `${s}s` : ''}`
  return `${s}s`
}

// relative renders a timestamp against now: "5m ago", "in 2h", "now"; "—" for none.
export function relative(ts, now = Date.now()) {
  if (isZeroTime(ts)) return '—'
  const t = Date.parse(ts)
  if (Number.isNaN(t)) return '—'
  const diff = (t - now) / 1000
  if (Math.abs(diff) < 1) return 'now'
  return diff > 0 ? `in ${duration(diff)}` : `${duration(-diff)} ago`
}

// absolute renders a timestamp in the viewer's locale, for tooltips and detail pages.
export const absolute = (ts) => (isZeroTime(ts) ? '' : new Date(ts).toLocaleString())

export function bytes(n) {
  if (!n) return '0 B'
  const u = ['B', 'kB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1000)))
  return `${(n / 1000 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

export const num = (n) => (n ?? 0).toLocaleString()

export const percent = (part, total) => (total ? `${((part / total) * 100).toFixed(2)}%` : '0.00%')

// pretty indents a JSON payload; anything else is returned as is.
export function pretty(p) {
  try {
    return JSON.stringify(JSON.parse(p), null, 2)
  } catch {
    return p ?? ''
  }
}

// highlight turns pretty JSON into escaped HTML with spans for keys, strings, numbers and literals (.code k/s/n/b).
export function highlight(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc(text).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, lit, n) =>
      str
        ? `<span class="${colon ? 'k' : 's'}">${str}</span>${colon || ''}`
        : lit
          ? `<span class="b">${lit}</span>`
          : `<span class="n">${n}</span>`,
  )
}

// shortId keeps the first block of a UUID (the tables show it, the title and the detail page the full one).
export const shortId = (id) => (id?.includes('-') ? id.slice(0, id.indexOf('-')) : id)

// sortRows returns the rows ordered by value(row, key): text in locale order, anything else numerically.
export function sortRows(rows, { key, desc }, value = (r, k) => r[k]) {
  return [...rows].sort((a, b) => {
    const x = value(a, key)
    const y = value(b, key)
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y
    return desc ? -c : c
  })
}

// nextSort: a click on the current column flips it; another column starts ascending for text, descending for numbers.
export const nextSort = (sort, key, numeric) => ({ key, desc: sort.key === key ? !sort.desc : numeric })

// parseDuration reads "90s", "15m", "2h" or "3d" (decimals allowed) as seconds; anything else is NaN.
export function parseDuration(s) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([smhd])\s*$/.exec(s || '')
  return m ? Math.round(Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]) : NaN
}
