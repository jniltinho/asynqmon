<script setup>
// Periodic tasks registered by asynq schedulers: spec, task, options, next and previous enqueue, and the enqueue
// history of each entry in a dialog.
import { computed, ref } from 'vue'
import { CalendarClock, History } from 'lucide-vue-next'
import { listEnqueueEvents, listSchedulerEntries } from '../api'
import { usePoll } from '../poll'
import { absolute, nextSort, relative, shortId, sortRows } from '../util'
import Empty from '../components/Empty.vue'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'
import SortTh from '../components/SortTh.vue'

const entries = ref([])
const now = ref(Date.now())
const { loaded, error, refresh } = usePoll(async () => {
  entries.value = (await listSchedulerEntries()).entries || []
  now.value = Date.now()
})

const sort = ref({ key: 'next', desc: false })
const VALUE = {
  id: (e) => e.id,
  spec: (e) => e.spec,
  payload: (e) => e.task_payload,
  options: (e) => e.options.join(' '),
  type: (e) => e.task_type,
  next: (e) => Date.parse(e.next_enqueue_at) || 0,
  prev: (e) => Date.parse(e.prev_enqueue_at) || 0,
}
const rows = computed(() => sortRows(entries.value, sort.value, (e, k) => VALUE[k](e)))
const sortBy = (key) => (sort.value = nextSort(sort.value, key, key === 'prev'))

const dlg = ref(null)
const history = ref(null) // { entry, events, error }
let seq = 0
async function showHistory(entry) {
  const id = ++seq // a reply for a dialog closed or replaced since is dropped
  history.value = { entry, events: null, error: '' }
  requestAnimationFrame(() => dlg.value?.showModal())
  try {
    const events = (await listEnqueueEvents(entry.id)).events || []
    if (id === seq && history.value) history.value.events = events
  } catch (e) {
    if (id === seq && history.value) history.value.error = e.message
  }
}
const close = () => (dlg.value?.close(), (history.value = null), seq++)
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="space-y-5">
    <ErrorNote v-if="error" what="the scheduler entries" :error="error" :stale="entries.length > 0" @retry="refresh" />
    <section v-if="!error || entries.length" class="card">
      <h2 class="card-h">Scheduler entries</h2>
      <Empty
        v-if="!entries.length"
        :icon="CalendarClock"
        title="No periodic tasks"
        hint="Entries show up here while an asynq.Scheduler with registered tasks is running."
      />
      <div v-else class="overflow-x-auto">
        <table class="grid-t border-0">
          <thead>
            <tr>
              <SortTh label="Entry" by="id" :sort="sort" @sort="sortBy" />
              <SortTh label="Spec" by="spec" :sort="sort" @sort="sortBy" />
              <SortTh label="Type" by="type" :sort="sort" @sort="sortBy" />
              <SortTh label="Payload" by="payload" :sort="sort" @sort="sortBy" />
              <SortTh label="Options" by="options" :sort="sort" @sort="sortBy" />
              <SortTh label="Next enqueue" by="next" :sort="sort" @sort="sortBy" />
              <SortTh label="Previous enqueue" by="prev" :sort="sort" @sort="sortBy" />
              <th class="text-right">History</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in rows" :key="e.id">
              <td class="font-mono" :title="e.id">{{ shortId(e.id) }}</td>
              <td class="font-mono whitespace-nowrap">{{ e.spec }}</td>
              <td class="font-mono whitespace-nowrap">{{ e.task_type }}</td>
              <td class="max-w-[300px] truncate font-mono text-[11.5px] text-fg-muted" :title="e.task_payload">
                {{ e.task_payload || '—' }}
              </td>
              <td class="text-[11.5px]">
                <span v-if="!e.options.length" class="text-fg-muted">none</span>
                <span v-for="o in e.options" :key="o" class="mr-1 inline-block bg-surface-2 px-1 font-mono">{{ o }}</span>
              </td>
              <td class="whitespace-nowrap" :title="absolute(e.next_enqueue_at)">{{ relative(e.next_enqueue_at, now) }}</td>
              <td class="whitespace-nowrap" :title="absolute(e.prev_enqueue_at)">{{ relative(e.prev_enqueue_at, now) }}</td>
              <td class="text-right">
                <button class="act" :aria-label="`Enqueue history of ${e.task_type} (${e.spec})`" @click="showHistory(e)">
                  <History :size="13" aria-hidden="true" /> history
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog
      v-if="history"
      ref="dlg"
      class="pnl w-[560px] max-w-[94vw]"
      aria-labelledby="history-title"
      @close="history = null"
      @cancel.prevent="close"
    >
      <h2 id="history-title" class="pnl-head">Enqueue history · {{ history.entry.task_type }} ({{ history.entry.spec }})</h2>
      <div class="pnl-body max-h-[60vh] overflow-y-auto">
        <p v-if="history.error" class="text-err" role="alert">{{ history.error }}</p>
        <LoadingNote v-else-if="!history.events" />
        <p v-else-if="!history.events.length" class="text-fg-muted">This entry has not enqueued a task yet.</p>
        <table v-else class="grid-t">
          <thead>
            <tr>
              <th>Task</th>
              <th>Enqueued</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in history.events" :key="ev.task_id">
              <td class="font-mono">{{ ev.task_id }}</td>
              <td :title="absolute(ev.enqueued_at)">{{ relative(ev.enqueued_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pnl-foot"><button class="btn-ghost" autofocus @click="close">Close</button></div>
    </dialog>
  </div>
</template>
