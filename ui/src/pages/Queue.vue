<script setup>
// One queue: its numbers, a tab per task state (with the count) and the tasks of the chosen state.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Pause, Play } from 'lucide-vue-next'
import { STATES, listQueues, pauseQueue, resumeQueue } from '../api'
import { toast } from '../toasts'
import { usePoll } from '../poll'
import { bytes, num, percent } from '../util'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'
import StateBar from '../components/StateBar.vue'
import TaskTable from '../components/TaskTable.vue'

const route = useRoute()
const router = useRouter()
const readOnly = window.READ_ONLY
const qname = computed(() => route.params.qname)
const queues = ref([])
const q = computed(() => queues.value.find((x) => x.queue === qname.value))

// the page is keyed by its path (App.vue): a reply that lands after leaving it must not rewrite the next page's URL
const here = route.path
const { loaded, error, refresh } = usePoll(async () => {
  queues.value = (await listQueues()).queues || []
  if (route.path !== here) return
  if (!STATES.includes(route.query.status)) pick(state.value) // pin the default, so it does not follow the counts
})

// the state in the URL (?status=), else the first state that has tasks
const state = computed(() => {
  const s = route.query.status
  if (STATES.includes(s)) return s
  return STATES.find((x) => q.value?.[x]) || 'active'
})
const pick = (s) => router.replace({ query: { status: s } })
const go = (name) => router.push({ path: `/queues/${encodeURIComponent(name)}`, query: { status: state.value } })

// arrow keys move between the state tabs (the WAI-ARIA tabs pattern)
function key(e) {
  const i = STATES.indexOf(state.value)
  const n = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
  if (!n) return
  pick(STATES[(i + n + STATES.length) % STATES.length])
  requestAnimationFrame(() => document.getElementById(`tab-${state.value}`)?.focus())
}

async function togglePause() {
  try {
    await (q.value.paused ? resumeQueue : pauseQueue)(qname.value)
    toast.success(`Queue "${qname.value}" ${q.value.paused ? 'resumed' : 'paused'}.`)
    refresh()
  } catch (e) {
    toast.error(e.message)
  }
}
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="page">
    <ErrorNote v-if="error" what="the queue" :error="error" :stale="queues.length > 0" @retry="refresh" />
    <div class="flex flex-wrap items-center gap-3">
      <nav aria-label="Breadcrumb" class="flex items-center gap-1 text-[13px]">
        <router-link to="/" class="text-link hover:text-link-hover">Queues</router-link>
        <ChevronRight :size="14" class="text-fg-muted" aria-hidden="true" />
        <label>
          <span class="sr-only">Queue</span>
          <select :value="qname" class="inp w-auto min-w-40 font-semibold" @change="go($event.target.value)">
            <option v-for="x in queues" :key="x.queue" :value="x.queue">{{ x.queue }}</option>
            <option v-if="!q" :value="qname">{{ qname }}</option>
          </select>
        </label>
      </nav>
      <span v-if="q" class="tag" :class="q.paused ? 'bg-warn-fill text-on-warn-fill' : 'bg-ok-soft text-on-ok-soft'">
        {{ q.paused ? 'paused' : 'running' }}
      </span>
      <button v-if="q && !readOnly" class="btn-ghost ml-auto" @click="togglePause">
        <component :is="q.paused ? Play : Pause" :size="13" aria-hidden="true" /> {{ q.paused ? 'Resume queue' : 'Pause queue' }}
      </button>
    </div>

    <p v-if="!q && !error" class="card px-3 py-4 text-fg-muted">Queue “{{ qname }}” has no tasks or does not exist.</p>
    <template v-if="q">
      <section class="card" aria-label="Queue numbers">
        <dl class="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
          <div
            v-for="[l, v, cls] in [
              ['Size', num(q.size)],
              ['Groups', num(q.groups)],
              ['Memory', bytes(q.memory_usage_bytes)],
              ['Latency', q.display_latency],
              ['Processed today', num(q.processed)],
              ['Failed today', num(q.failed), q.failed ? 'text-err' : ''],
              ['Error rate', percent(q.failed, q.processed), q.failed ? 'text-err' : ''],
            ]"
            :key="l"
            class="px-3 py-2"
          >
            <dt class="text-[11px] font-semibold text-fg-muted uppercase">{{ l }}</dt>
            <dd class="text-lg font-semibold tabular-nums" :class="cls || 'text-fg-strong'">{{ v }}</dd>
          </div>
        </dl>
        <div class="border-t border-line px-3 py-2"><StateBar :queue="q" /></div>
      </section>

      <section class="card fill">
        <div class="subtabs mb-0! px-2 pt-2" role="tablist" aria-label="Task state" @keydown="key">
          <button
            v-for="s in STATES"
            :id="`tab-${s}`"
            :key="s"
            role="tab"
            class="subtab"
            :class="[{ on: s === state }, `st-${s}`]"
            :aria-selected="s === state"
            :tabindex="s === state ? 0 : -1"
            aria-controls="tasks"
            @click="pick(s)"
          >
            <span class="dot" aria-hidden="true"></span>
            {{ s[0].toUpperCase() + s.slice(1) }}
            <span class="font-normal tabular-nums">{{ num(q[s]) }}</span>
          </button>
        </div>
        <div id="tasks" class="grow" role="tabpanel" :aria-labelledby="`tab-${state}`">
          <TaskTable :key="`${qname}/${state}`" :qname="qname" :state="state" :count="q[state]" @changed="refresh" />
        </div>
      </section>
    </template>
  </div>
</template>
