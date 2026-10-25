<script setup>
// Queues overview: totals, the size of each queue by state, the tasks processed per day and the queue list with
// pause / resume / delete.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Inbox, Pause, Play, Search, Trash2 } from 'lucide-vue-next'
import { STATES, deleteQueue, listQueueStats, listQueues, pauseQueue, resumeQueue } from '../api'
import { confirmTyped } from '../dialogs'
import { toast } from '../toasts'
import { usePoll } from '../poll'
import { settings } from '../settings'
import { bytes, nextSort, num, percent, sortRows } from '../util'
import Chart from '../components/Chart.vue'
import Empty from '../components/Empty.vue'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'
import SortTh from '../components/SortTh.vue'
import Stat from '../components/Stat.vue'
import StateBar from '../components/StateBar.vue'

const router = useRouter()
const readOnly = window.READ_ONLY
const queues = ref([])
const daily = ref({})
const { error, loaded, refresh } = usePoll(async () => {
  const [q, s] = await Promise.all([listQueues(), listQueueStats()])
  queues.value = q.queues || []
  daily.value = s.stats || {}
})

const sum = (k) => queues.value.reduce((n, q) => n + (q[k] || 0), 0)
const paused = computed(() => queues.value.filter((q) => q.paused).length)

// queue table: filter and sort
const filter = ref('')
const sort = ref({ key: 'queue', desc: false })
const columns = [
  ['queue', 'Queue'],
  ['paused', 'State'],
  ['size', 'Size'],
  [null, 'Tasks by state'],
  ['memory_usage_bytes', 'Memory'],
  ['latency_msec', 'Latency'],
  ['processed', 'Processed today'],
  ['failed', 'Failed today'],
  ['error_rate', 'Error rate'],
]
const rate = (q) => (q.processed ? q.failed / q.processed : 0)
const rows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const shown = queues.value.filter((q) => !f || q.queue.toLowerCase().includes(f))
  return sortRows(shown, sort.value, (q, k) => (k === 'error_rate' ? rate(q) : q[k]))
})
const sortBy = (key) => (sort.value = nextSort(sort.value, key, key !== 'queue'))

// charts
const sizeSeries = computed(() =>
  STATES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), color: `state-${s}`, data: queues.value.map((q) => q[s]) })),
)
const RANGES = [
  ['today', 'Today'],
  ['last-7d', 'Last 7 days'],
  ['last-30d', 'Last 30 days'],
  ['last-90d', 'Last 90 days'],
]
const days = computed(() => ({ today: 1, 'last-7d': 7, 'last-30d': 30, 'last-90d': 90 })[settings.dailyStats] || 7)
const processed = computed(() => {
  if (settings.dailyStats === 'today') {
    const today = (q) => daily.value[q.queue]?.[0] || { processed: 0, failed: 0 }
    return {
      labels: queues.value.map((q) => q.queue),
      series: [
        { label: 'Succeeded', color: 'state-completed', data: queues.value.map((q) => today(q).processed - today(q).failed) },
        { label: 'Failed', color: 'state-archived', data: queues.value.map((q) => today(q).failed) },
      ],
    }
  }
  // History lists the newest day first; sum the queues per date
  const byDate = new Map()
  for (const list of Object.values(daily.value))
    for (const d of list.slice(0, days.value)) {
      const k = d.date.slice(0, 10)
      const v = byDate.get(k) || { processed: 0, failed: 0 }
      byDate.set(k, { processed: v.processed + d.processed, failed: v.failed + d.failed })
    }
  const dates = [...byDate.keys()].sort()
  return {
    labels: dates.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })),
    series: [
      { label: 'Succeeded', color: 'state-completed', data: dates.map((d) => byDate.get(d).processed - byDate.get(d).failed) },
      { label: 'Failed', color: 'state-archived', data: dates.map((d) => byDate.get(d).failed) },
    ],
  }
})

async function togglePause(q) {
  try {
    await (q.paused ? resumeQueue : pauseQueue)(q.queue)
    toast.success(`Queue "${q.queue}" ${q.paused ? 'resumed' : 'paused'}.`)
    refresh()
  } catch (e) {
    toast.error(e.message)
  }
}
async function remove(q) {
  const ok = await confirmTyped(`Delete queue "${q.queue}"? Only an empty queue can be deleted (it has ${num(q.size)} task(s)).`, q.queue, {
    title: 'Delete queue',
  })
  if (!ok) return
  try {
    await deleteQueue(q.queue)
    toast.success(`Queue "${q.queue}" deleted.`)
    refresh()
  } catch (e) {
    toast.error(e.message)
  }
}
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="page">
    <ErrorNote v-if="error" what="the queues" :error="error" :stale="queues.length > 0" @retry="refresh" />

    <section v-if="!error || queues.length" class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Totals">
      <Stat label="Queues" :value="num(queues.length)" :note="paused ? `${paused} paused` : 'all running'" :icon="Inbox" />
      <Stat label="Active" :value="num(sum('active'))" tone="active" note="being processed" />
      <Stat label="Pending" :value="num(sum('pending'))" tone="pending" note="ready to run" />
      <Stat label="Scheduled" :value="num(sum('scheduled'))" tone="scheduled" note="to run later" />
      <Stat label="Retry" :value="num(sum('retry'))" tone="retry" note="failed, will retry" />
      <Stat
        label="Processed today"
        :value="num(sum('processed'))"
        :tone="sum('failed') ? 'err' : 'ok'"
        :note="
          sum('processed') ? `${num(sum('failed'))} failed · ${percent(sum('failed'), sum('processed'))} error rate` : 'nothing yet today'
        "
      />
    </section>

    <div v-if="queues.length" class="grid gap-5 lg:grid-cols-2">
      <section class="card flex flex-col">
        <h2 class="card-h">Queue size by state</h2>
        <div class="chart-h p-3">
          <Chart
            type="bar"
            horizontal
            stacked
            :labels="queues.map((q) => q.queue)"
            :series="sizeSeries"
            label="Stacked bars: the tasks of each queue by state"
          />
        </div>
      </section>
      <section class="card flex flex-col">
        <h2 class="card-h justify-between">
          Tasks processed
          <select v-model="settings.dailyStats" class="inp w-36 normal-case" aria-label="Period">
            <option v-for="[v, l] in RANGES" :key="v" :value="v">{{ l }}</option>
          </select>
        </h2>
        <div class="chart-h p-3">
          <Chart
            :type="settings.dailyStats === 'today' ? 'bar' : 'line'"
            :stacked="settings.dailyStats === 'today'"
            :area="settings.dailyStats !== 'today'"
            :labels="processed.labels"
            :series="processed.series"
            label="Succeeded and failed tasks"
          />
        </div>
      </section>
    </div>

    <section v-if="!error || queues.length" class="card fill">
      <h2 class="card-h justify-between">
        Queues
        <label class="relative w-56 font-normal normal-case">
          <span class="sr-only">Filter queues</span>
          <Search :size="13" class="absolute top-1/2 left-2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input v-model="filter" class="inp pl-7" placeholder="Filter queues…" />
        </label>
      </h2>
      <Empty v-if="!queues.length" :icon="Inbox" title="No queues yet" hint="Queues appear here once a task is enqueued with asynq." />
      <div v-else class="scroll">
        <table class="grid-t border-0">
          <thead>
            <tr>
              <template v-for="[key, label] in columns" :key="label">
                <SortTh
                  v-if="key"
                  :label="label"
                  :by="key"
                  :sort="sort"
                  :class="['queue', 'paused'].includes(key) ? '' : 'text-right'"
                  @sort="sortBy"
                />
                <th v-else>{{ label }}</th>
              </template>
              <th v-if="!readOnly" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length">
              <td :colspan="columns.length + 1" class="py-4 text-center text-fg-muted">No queue matches “{{ filter }}”.</td>
            </tr>
            <tr v-for="q in rows" :key="q.queue" class="cursor-pointer" @click="router.push(`/queues/${encodeURIComponent(q.queue)}`)">
              <td>
                <router-link
                  :to="`/queues/${encodeURIComponent(q.queue)}`"
                  class="font-semibold text-link hover:text-link-hover"
                  @click.stop
                >
                  {{ q.queue }}
                </router-link>
              </td>
              <td>
                <span class="tag" :class="q.paused ? 'bg-warn-fill text-on-warn-fill' : 'bg-ok-soft text-on-ok-soft'">
                  {{ q.paused ? 'paused' : 'running' }}
                </span>
              </td>
              <td class="text-right tabular-nums">{{ num(q.size) }}</td>
              <td class="w-[22%]"><StateBar :queue="q" /></td>
              <td class="text-right tabular-nums">{{ bytes(q.memory_usage_bytes) }}</td>
              <td class="text-right tabular-nums">{{ q.display_latency }}</td>
              <td class="text-right tabular-nums">{{ num(q.processed) }}</td>
              <td class="text-right tabular-nums" :class="q.failed ? 'text-err' : ''">{{ num(q.failed) }}</td>
              <td class="text-right tabular-nums" :class="q.failed ? 'text-err' : ''">{{ percent(q.failed, q.processed) }}</td>
              <td v-if="!readOnly" class="text-right whitespace-nowrap" @click.stop>
                <button class="act" :aria-label="`${q.paused ? 'Resume' : 'Pause'} queue ${q.queue}`" @click="togglePause(q)">
                  <component :is="q.paused ? Play : Pause" :size="13" aria-hidden="true" /> {{ q.paused ? 'resume' : 'pause' }}
                </button>
                <button class="act" :aria-label="`Delete queue ${q.queue}`" @click="remove(q)">
                  <Trash2 :size="13" aria-hidden="true" /> delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
