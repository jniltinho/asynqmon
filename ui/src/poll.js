// usePoll runs fn now and then every settings.pollInterval seconds while settings.live is on and the tab is visible
// (a hidden tab catches up when it shows again). refresh() asked for while a fetch runs (a new page, a filter, after
// an action) runs again right after it, so the last change always gets its own data; a timer tick then is skipped,
// so a server slower than the interval cannot keep the loop going. It returns { refresh, error, loaded }.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { settings } from './settings'

export const lastRefresh = ref(null)

export function usePoll(fn) {
  const error = ref('')
  const loaded = ref(false)
  let timer = null
  let busy = false
  let again = false
  async function refresh(queue) {
    if (busy) return void (again ||= queue !== false) // watchers and events pass their own arguments
    busy = true
    do {
      again = false
      try {
        await fn()
        error.value = ''
        lastRefresh.value = new Date()
      } catch (e) {
        error.value = e.message
      }
      loaded.value = true
    } while (again)
    busy = false
  }
  const schedule = () => {
    clearInterval(timer)
    if (settings.live) timer = setInterval(() => !document.hidden && refresh(false), settings.pollInterval * 1000)
  }
  const onVisible = () => !document.hidden && settings.live && refresh()
  onMounted(() => {
    refresh()
    schedule()
    document.addEventListener('visibilitychange', onVisible)
  })
  watch(() => [settings.pollInterval, settings.live], schedule)
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
  return { refresh, error, loaded }
}
