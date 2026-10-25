<script setup>
// Time series from Prometheus (--prometheus-addr): a window (duration) ending now (live) or at a fixed time, the
// queues to show, and a chart per metric with a series per queue.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Radio } from 'lucide-vue-next'
import { getMetrics, listQueues } from '../api'
import { usePoll } from '../poll'
import { bytes, duration, parseDuration } from '../util'
import Chart from '../components/Chart.vue'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'

const route = useRoute()
const router = useRouter()
const DURATIONS = [
  [3600, '1 hour'],
  [6 * 3600, '6 hours'],
  [86400, '1 day'],
  [8 * 86400, '8 days'],
  [30 * 86400, '30 days'],
]
// the same URL parameters as the React UI: ?duration=<sec>&end=<unix sec> (no end: live)
const durationSec = computed(() => Number(route.query.duration) || 3600)
const endSec = computed(() => Number(route.query.end) || 0)
const set = (q) => router.replace({ query: { ...route.query, ...q } })

const queues = ref([])
const chosen = ref(null) // null: every queue; a Set: those queues (maybe none)
const data = ref(null)
const fetchedEnd = ref(0)

const { loaded, error, refresh } = usePoll(async () => {
  const end = endSec.value || Math.floor(Date.now() / 1000)
  const none = chosen.value?.size === 0
  const [q, m] = await Promise.all([listQueues(), none ? null : getMetrics(end, durationSec.value, [...(chosen.value || [])])])
  queues.value = (q.queues || []).map((x) => x.queue).sort()
  data.value = m
  fetchedEnd.value = end
})
watch([durationSec, endSec, chosen], refresh, { deep: true })

function toggleQueue(name) {
  const s = new Set(chosen.value || queues.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  chosen.value = s.size === queues.value.length ? null : s
}
const isOn = (name) => !chosen.value || chosen.value.has(name)

// a window typed as 90m, 2h or 3d (the React UI's custom duration)
const custom = ref('')
const customBad = ref(false)
function customWindow() {
  const sec = parseDuration(custom.value)
  customBad.value = !(sec > 0)
  if (!customBad.value) set({ duration: String(sec) })
}

function shift(sec) {
  const base = endSec.value || Math.floor(Date.now() / 1000)
  const end = base + sec
  set({ end: end >= Date.now() / 1000 ? undefined : String(end) })
}
const endInput = computed({
  get: () => {
    const d = new Date((endSec.value || fetchedEnd.value || Date.now() / 1000) * 1000)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  },
  set: (v) => v && set({ end: String(Math.floor(new Date(v).getTime() / 1000)) }),
})

const PALETTE = [
  'state-active',
  'state-retry',
  'state-completed',
  'state-scheduled',
  'state-archived',
  'state-pending',
  'state-aggregating',
]
// a queue keeps its color in every chart and whatever the filter: the color of its place in the sorted queue list
const colorOf = (name, n) => PALETTE[(queues.value.includes(name) ? queues.value.indexOf(name) : n) % PALETTE.length]
const fmtNum = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v).toLocaleString() : Number(v.toPrecision(3)).toString())
const METRICS = [
  ['tasks_processed_per_second', 'Tasks processed', 'Tasks processed (succeeded and failed) per second.', fmtNum],
  ['tasks_failed_per_second', 'Tasks failed', 'Tasks failed per second.', fmtNum],
  ['error_rate', 'Error rate', 'Share of the processed tasks that failed.', (v) => `${Number((v * 100).toPrecision(3))}%`],
  ['queue_size', 'Queue size', 'Tasks in the queue, in every state.', fmtNum],
  ['queue_latency_seconds', 'Queue latency', 'Age of the oldest pending task of the queue.', (v) => `${fmtNum(v)}s`],
  ['queue_memory_usage_approx_bytes', 'Memory usage (approx.)', 'Memory used by the queue, estimated by sampling tasks.', bytes],
  ['pending_tasks_by_queue', 'Pending tasks', 'Tasks waiting to be processed.', fmtNum],
  ['retry_tasks_by_queue', 'Retry tasks', 'Failed tasks waiting for a retry.', fmtNum],
  ['archived_tasks_by_queue', 'Archived tasks', 'Tasks that exhausted their retries or were archived.', fmtNum],
]
const charts = computed(() =>
  METRICS.map(([key, title, help, fmt]) => {
    const r = data.value?.[key]
    const result = r?.status === 'success' ? r.data?.result || [] : []
    const series = result.map((m, n) => ({
      label: m.metric.queue || m.metric.__name__ || key,
      color: colorOf(m.metric.queue, n),
      data: m.values.map(([x, y]) => ({ x, y: Number(y) })),
    }))
    return { key, title, help, fmt, series, error: r?.status === 'error' ? r.error : '' }
  }),
)
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="space-y-4">
    <section class="card flex flex-wrap items-end gap-x-5 gap-y-3 px-3 py-3" aria-label="Time window">
      <label>
        <span class="lbl">Window</span>
        <select class="inp w-32" :value="durationSec" @change="set({ duration: $event.target.value })">
          <option v-for="[v, l] in DURATIONS" :key="v" :value="v">{{ l }}</option>
          <option v-if="!DURATIONS.some(([v]) => v === durationSec)" :value="durationSec">{{ duration(durationSec) }}</option>
        </select>
      </label>
      <form class="flex items-end gap-1" @submit.prevent="customWindow">
        <label>
          <span class="lbl">Custom window</span>
          <input
            v-model="custom"
            class="inp w-28"
            :class="{ invalid: customBad }"
            placeholder="e.g. 90m, 2d"
            :aria-invalid="customBad"
            aria-describedby="custom-hint"
          />
        </label>
        <button class="btn-ghost" :disabled="!custom.trim()">Apply</button>
        <span id="custom-hint" class="sr-only">A number followed by s, m, h or d.</span>
      </form>
      <div>
        <span id="end-label" class="lbl">Ending at</span>
        <div class="flex flex-wrap items-center gap-1" role="group" aria-labelledby="end-label">
          <button class="btn-ghost px-2" aria-label="One window earlier" @click="shift(-durationSec)">
            <ChevronLeft :size="14" aria-hidden="true" />
          </button>
          <input v-model.lazy="endInput" type="datetime-local" class="inp w-52 max-w-full" aria-label="End time" />
          <button class="btn-ghost px-2" :disabled="!endSec" aria-label="One window later" @click="shift(durationSec)">
            <ChevronRight :size="14" aria-hidden="true" />
          </button>
          <button :class="endSec ? 'btn-ghost' : 'btn'" :aria-pressed="!endSec" @click="set({ end: undefined })">
            <Radio :size="13" aria-hidden="true" /> Live
          </button>
        </div>
      </div>
      <fieldset class="min-w-0 flex-1">
        <legend class="lbl">Queues</legend>
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <label v-for="name in queues" :key="name" class="flex items-center gap-1.5">
            <input type="checkbox" :checked="isOn(name)" @change="toggleQueue(name)" />
            {{ name }}
          </label>
        </div>
      </fieldset>
    </section>
    <ErrorNote v-if="error" what="the metrics" :error="error" :stale="!!data" @retry="refresh" />
    <p v-if="chosen?.size === 0" class="card px-3 py-4 text-fg-muted">Select at least one queue to see its metrics.</p>

    <div v-if="data" class="grid gap-4 xl:grid-cols-2">
      <section v-for="c in charts" :key="c.key" class="card">
        <h2 class="card-h" :title="c.help">{{ c.title }}</h2>
        <p class="px-3 pt-2 text-[11px] text-fg-muted">{{ c.help }}</p>
        <p v-if="c.error" class="px-3 py-6 text-center text-err">{{ c.error }}</p>
        <p v-else-if="!c.series.length" class="px-3 py-10 text-center text-fg-muted">No data in this window.</p>
        <div v-else class="h-64 p-3">
          <Chart time :series="c.series" :y-format="c.fmt" :label="`${c.title} over time, one line per queue`" />
        </div>
      </section>
    </div>
  </div>
</template>
