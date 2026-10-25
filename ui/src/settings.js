// Viewer settings, kept in this browser (localStorage "asynqmon:settings"; index.html reads the theme before the
// first paint). Changing the theme or the flat look applies it to <html> at once.
import { reactive, watch } from 'vue'
import { themes } from './themes/registry'

const KEY = 'asynqmon:settings'
const DEFAULTS = { theme: 'default', flat: false, pollInterval: 8, pageSize: 20, dailyStats: 'last-7d', live: true }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export const settings = reactive(load())

// "auto" follows the system: Default on a light system, Grafana on a dark one.
const dark = matchMedia('(prefers-color-scheme: dark)')
export const themeOf = (id) => themes.find((t) => t.id === (id === 'auto' ? (dark.matches ? 'grafana' : 'default') : id)) || themes[0]

function apply() {
  const t = themeOf(settings.theme)
  const html = document.documentElement
  html.dataset.theme = t.id
  html.dataset.flat = String(!!settings.flat)
  html.dataset.scheme = t.scheme
  html.style.colorScheme = t.scheme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t.scheme)
}
apply()
dark.addEventListener('change', apply)
watch(
  settings,
  () => {
    apply()
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // private mode / storage blocked: the settings last for this page only
    }
  },
  { deep: true },
)
