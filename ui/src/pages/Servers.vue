<script setup>
// The asynq servers (workers) connected to Redis: status, queue priorities, how busy they are, and on demand the
// tasks each one is processing now.
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight, ServerOff } from 'lucide-vue-next'
import { listServers } from '../api'
import { usePoll } from '../poll'
import { absolute, nextSort, num, relative, shortId, sortRows } from '../util'
import Empty from '../components/Empty.vue'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'
import SortTh from '../components/SortTh.vue'
import Stat from '../components/Stat.vue'

const servers = ref([])
const now = ref(Date.now())
const { loaded, error, refresh } = usePoll(async () => {
  servers.value = (await listServers()).servers || []
  now.value = Date.now()
})
const open = ref(new Set())
function toggle(id) {
  const s = new Set(open.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  open.value = s
}
const busy = computed(() => servers.value.reduce((n, s) => n + (s.active_workers?.length || 0), 0))
const capacity = computed(() => servers.value.reduce((n, s) => n + s.concurrency, 0))
const sort = ref({ key: 'host', desc: false })
const VALUE = {
  host: (s) => `${s.host}:${String(s.pid).padStart(10, '0')}`,
  start_time: (s) => Date.parse(s.start_time) || 0,
  status: (s) => s.status,
  queues: (s) =>
    queuesOf(s)
      .map(([q]) => q)
      .join(' '),
  busy: (s) => s.active_workers.length / (s.concurrency || 1),
}
const rows = computed(() => sortRows(servers.value, sort.value, (s, k) => VALUE[k](s)))
const sortBy = (key) => (sort.value = nextSort(sort.value, key, key === 'busy'))
const queuesOf = (s) => Object.entries(s.queue_priorities || {}).sort((a, b) => b[1] - a[1])
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="space-y-5">
    <ErrorNote v-if="error" what="the servers" :error="error" :stale="servers.length > 0" @retry="refresh" />
    <section v-if="!error || servers.length" class="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
      <Stat label="Servers" :value="num(servers.length)" :note="`${servers.filter((s) => s.status === 'active').length} active`" />
      <Stat label="Workers busy" :value="`${num(busy)} / ${num(capacity)}`" tone="active" note="active tasks / concurrency" />
      <Stat
        label="Utilization"
        :value="capacity ? `${Math.round((busy / capacity) * 100)}%` : '—'"
        :tone="capacity && busy / capacity > 0.9 ? 'warn' : 'ok'"
        note="of all workers"
      />
      <Stat label="Hosts" :value="num(new Set(servers.map((s) => s.host)).size)" tone="muted" />
    </section>

    <section v-if="!error || servers.length" class="card">
      <h2 class="card-h">Servers</h2>
      <Empty
        v-if="!servers.length"
        :icon="ServerOff"
        title="No servers running"
        hint="Servers show up here while an asynq.Server is connected to this Redis."
      />
      <div v-else class="overflow-x-auto">
        <table class="grid-t border-0">
          <thead>
            <tr>
              <th class="w-8"><span class="sr-only">Details</span></th>
              <SortTh label="Host" by="host" :sort="sort" @sort="sortBy" />
              <SortTh label="Started" by="start_time" :sort="sort" @sort="sortBy" />
              <SortTh label="Status" by="status" :sort="sort" @sort="sortBy" />
              <SortTh label="Queues (priority)" by="queues" :sort="sort" @sort="sortBy" />
              <SortTh label="Workers busy" by="busy" :sort="sort" @sort="sortBy" />
            </tr>
          </thead>
          <tbody>
            <template v-for="s in rows" :key="s.id">
              <tr>
                <td>
                  <button
                    class="act px-0"
                    :aria-expanded="open.has(s.id)"
                    :aria-label="`${open.has(s.id) ? 'Hide' : 'Show'} the active tasks of ${s.host}:${s.pid}`"
                    @click="toggle(s.id)"
                  >
                    <component :is="open.has(s.id) ? ChevronDown : ChevronRight" :size="14" aria-hidden="true" />
                  </button>
                </td>
                <td class="font-mono whitespace-nowrap">{{ s.host }}:{{ s.pid }}</td>
                <td class="whitespace-nowrap" :title="absolute(s.start_time)">{{ relative(s.start_time, now) }}</td>
                <td>
                  <span
                    class="tag"
                    :class="s.status === 'active' ? 'bg-ok-fill text-on-ok-fill' : 'bg-neutral-fill text-on-neutral-fill'"
                    >{{ s.status }}</span
                  >
                </td>
                <td>
                  <span v-for="[q, p] in queuesOf(s)" :key="q" class="mr-2 inline-block whitespace-nowrap">
                    <router-link :to="`/queues/${encodeURIComponent(q)}`" class="text-link hover:text-link-hover">{{ q }}</router-link>
                    <span class="text-fg-muted"> {{ p }}</span>
                  </span>
                  <span v-if="s.strict_priority_enabled" class="tag bg-strong-fill text-on-strong-fill" title="Strict priority"
                    >strict</span
                  >
                </td>
                <td class="w-56">
                  <div class="flex items-center gap-2">
                    <div class="stackbar flex-1" role="img" :aria-label="`${s.active_workers.length} of ${s.concurrency} workers busy`">
                      <span class="st-active" :style="{ width: `${(s.active_workers.length / s.concurrency) * 100}%` }"></span>
                    </div>
                    <span class="tabular-nums">{{ s.active_workers.length }} / {{ s.concurrency }}</span>
                  </div>
                </td>
              </tr>
              <tr v-if="open.has(s.id)" class="bg-surface!">
                <td></td>
                <td colspan="5" class="py-2">
                  <p v-if="!s.active_workers.length" class="text-fg-muted">No task is being processed.</p>
                  <table v-else class="grid-t">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Type</th>
                        <th>Payload</th>
                        <th>Queue</th>
                        <th>Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="w in s.active_workers" :key="w.task_id">
                        <td class="font-mono">
                          <router-link
                            :to="`/queues/${encodeURIComponent(w.queue)}/tasks/${encodeURIComponent(w.task_id)}`"
                            class="text-link hover:text-link-hover"
                            :title="w.task_id"
                            >{{ shortId(w.task_id) }}</router-link
                          >
                        </td>
                        <td class="font-mono">{{ w.task_type }}</td>
                        <td class="max-w-[360px] truncate font-mono text-[11.5px] text-fg-muted" :title="w.task_payload">
                          {{ w.task_payload }}
                        </td>
                        <td>{{ w.queue }}</td>
                        <td :title="absolute(w.start_time)">{{ relative(w.start_time, now) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
