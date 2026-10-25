// Viewer settings, kept in this browser (localStorage "asynqmon:settings"; index.html reads the theme before the
// first paint). Changing the theme or the flat look applies it to <html> at once. When the application that embeds
// asynqmon sets the theme (Options.Theme: data-host-theme on <html>), the host's theme and flat look win.
import { reactive, ref, watch } from 'vue'
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

// the host application's theme, read once from the page the server rendered; null when asynqmon runs standalone
const html = document.documentElement
// (a host "auto" theme was resolved before the first paint; data-host-auto keeps it following the system)
export const hostTheme =
  html.dataset.hostTheme === 'true'
    ? { id: html.dataset.hostAuto === 'true' ? 'auto' : html.dataset.theme, flat: html.dataset.flat === 'true' }
    : null

// "auto" follows the system: Default on a light system, Grafana on a dark one.
// (a ref, so what shows the resolved theme follows a change of the system's preference)
const dark = matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(dark.matches)
export const themeOf = (id) => themes.find((t) => t.id === (id === 'auto' ? (systemDark.value ? 'grafana' : 'default') : id)) || themes[0]

function apply() {
  const t = themeOf(hostTheme ? hostTheme.id : settings.theme)
  html.dataset.theme = t.id
  html.dataset.flat = String(hostTheme ? hostTheme.flat : !!settings.flat)
  html.dataset.scheme = t.scheme
  html.style.colorScheme = t.scheme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t.scheme)
}
apply()
dark.addEventListener('change', () => {
  systemDark.value = dark.matches
  apply()
})
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
