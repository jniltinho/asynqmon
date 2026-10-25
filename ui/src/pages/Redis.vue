<script setup>
// The Redis server (or cluster): the key numbers, the queue locations of a cluster and the full INFO, a tab per
// section (Server, Clients, Memory…) with a filter over all of them.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, X } from 'lucide-vue-next'
import { getRedisInfo } from '../api'
import { usePoll } from '../poll'
import { duration, num } from '../util'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'
import Stat from '../components/Stat.vue'

const data = ref(null)
const { loaded, error, refresh } = usePoll(async () => (data.value = await getRedisInfo()))
const i = computed(() => data.value?.info || {})

const ratio = computed(() => Number(i.value.mem_fragmentation_ratio || 0))
const lastSave = computed(() => (i.value.rdb_last_save_time ? new Date(i.value.rdb_last_save_time * 1000).toLocaleString() : '—'))

// raw INFO → sections of [key, value]
const sections = computed(() => {
  const out = []
  for (const line of (data.value?.raw_info || '').split(/\r?\n/)) {
    if (line.startsWith('# ')) out.push({ name: line.slice(2), rows: [] })
    else if (line.includes(':')) {
      // CLUSTER INFO (a cluster) has no section headings: its fields go into one "Cluster" section
      if (!out.length) out.push({ name: 'Cluster', rows: [] })
      out.at(-1).rows.push([line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)])
    }
  }
  return out
})

// the filter applies to every section: each tab shows how many of its fields match
const filter = ref('')
const term = computed(() => filter.value.trim().toLowerCase())
const shown = computed(() =>
  sections.value.map((s) => ({
    ...s,
    id: s.name.toLowerCase(),
    rows: term.value ? s.rows.filter(([k, v]) => k.toLowerCase().includes(term.value) || v.toLowerCase().includes(term.value)) : s.rows,
  })),
)

// the current section lives in the URL (?section=memory), so a link opens it
const route = useRoute()
const router = useRouter()
const current = computed(() => shown.value.find((s) => s.id === route.query.section) || shown.value[0])
const pick = (id) => router.replace({ query: { ...route.query, section: id } })
// from the "Found in" links: the focus follows to the tab picked (the link it was on goes away)
const focusTab = (id) => requestAnimationFrame(() => document.getElementById(`info-tab-${id}`)?.focus())
function jump(id) {
  pick(id)
  focusTab(id)
}
// the × clears the filter and gives the focus back to the field (the button goes away)
const field = ref(null)
function clear() {
  filter.value = ''
  field.value?.focus()
}
const elsewhere = computed(() => shown.value.filter((s) => s !== current.value && s.rows.length))

// arrow keys, Home and End move between the tabs (the WAI-ARIA tabs pattern)
function key(e) {
  const ids = shown.value.map((s) => s.id)
  const i = ids.indexOf(current.value?.id)
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key]
  if (next === undefined) return
  e.preventDefault()
  const id = ids[(next + ids.length) % ids.length]
  pick(id)
  focusTab(id)
}

// another section starts at its top (the panel is the same element, so it would keep the last scroll position)
const panel = ref(null)
watch(
  () => current.value?.id,
  () => panel.value && (panel.value.scrollTop = 0),
)

// a long section in two columns: the rows split in halves, read top to bottom
const columns = computed(() => {
  const rows = current.value?.rows || []
  if (rows.length < 16) return [rows]
  const half = Math.ceil(rows.length / 2)
  return [rows.slice(0, half), rows.slice(half)]
})
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="page">
    <ErrorNote v-if="error" what="the Redis INFO" :error="error" :stale="!!data" @retry="refresh" />
    <template v-if="data">
      <!-- a cluster replies CLUSTER INFO, not INFO: its own cards -->
      <section v-if="data.cluster" class="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Cluster">
        <Stat label="Cluster state" :value="i.cluster_state || '—'" :tone="i.cluster_state === 'ok' ? 'ok' : 'err'" />
        <Stat
          label="Slots"
          :value="`${num(Number(i.cluster_slots_ok || 0))} ok`"
          :tone="Number(i.cluster_slots_fail) || Number(i.cluster_slots_pfail) ? 'err' : 'ok'"
          :note="`${i.cluster_slots_assigned || 0} assigned · ${i.cluster_slots_pfail || 0} pfail · ${i.cluster_slots_fail || 0} fail`"
        />
        <Stat label="Known nodes" :value="num(Number(i.cluster_known_nodes || 0))" tone="active" />
        <Stat label="Masters" :value="num(Number(i.cluster_size || 0))" tone="muted" note="serving slots" />
        <Stat label="Epoch" :value="i.cluster_current_epoch || '—'" tone="muted" />
      </section>
      <section v-else class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="Key numbers">
        <Stat label="Version" :value="i.redis_version" :note="data.cluster ? 'cluster' : i.redis_mode" />
        <Stat label="Uptime" :value="i.uptime_in_seconds ? duration(i.uptime_in_seconds) : '—'" tone="muted" />
        <Stat label="Clients" :value="num(Number(i.connected_clients))" tone="active" :note="`${i.blocked_clients || 0} blocked`" />
        <Stat
          label="Memory used"
          :value="i.used_memory_human"
          :note="`of ${i.maxmemory_human === '0B' ? 'no limit' : i.maxmemory_human}`"
        />
        <Stat
          label="Peak memory"
          :value="i.used_memory_peak_human"
          tone="muted"
          :note="i.used_memory_peak_perc && `now ${i.used_memory_peak_perc} of peak`"
        />
        <Stat
          label="Fragmentation"
          :value="i.mem_fragmentation_ratio || '—'"
          :tone="ratio > 1.5 ? 'warn' : 'ok'"
          :note="ratio > 1.5 ? 'high: consider restarting' : 'ratio rss / used'"
        />
        <Stat label="Replicas" :value="num(Number(i.connected_slaves || 0))" tone="muted" :note="i.role" />
        <Stat label="Unsaved changes" :value="num(Number(i.rdb_changes_since_last_save || 0))" tone="muted" :note="`saved ${lastSave}`" />
      </section>

      <!-- a cluster: where each queue lives and the nodes, side by side, each scrolling inside (the page does not) -->
      <section v-if="data.cluster" class="card">
        <h2 class="card-h">Queue locations and nodes</h2>
        <div class="grid gap-3 p-3 lg:grid-cols-2">
          <div class="scroll max-h-48 border border-line" tabindex="0" role="region" aria-label="Queue locations">
            <table class="grid-t border-0">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Key slot</th>
                  <th>Nodes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in data.queue_locations || []" :key="l.queue">
                  <td>{{ l.queue }}</td>
                  <td class="tabular-nums">{{ l.keyslot }}</td>
                  <td class="font-mono">{{ l.nodes.join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre class="code m-0 max-h-48 overflow-auto" tabindex="0" aria-label="CLUSTER NODES">{{ data.raw_cluster_nodes }}</pre>
        </div>
      </section>

      <section class="card fill">
        <h2 class="card-h justify-between">
          {{ data.cluster ? 'CLUSTER INFO' : 'INFO' }} · {{ data.address }}
          <label class="relative w-56 font-normal normal-case">
            <span class="sr-only">Filter every section by key or value</span>
            <Search :size="13" class="absolute top-1/2 left-2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <input ref="field" v-model="filter" class="inp pr-7 pl-7" placeholder="Filter keys or values…" @keydown.esc="filter = ''" />
            <button
              v-if="filter"
              type="button"
              class="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer p-1 text-fg-muted hover:text-fg"
              aria-label="Clear the filter"
              @click="clear"
            >
              <X :size="12" aria-hidden="true" />
            </button>
          </label>
        </h2>
        <div class="subtabs mb-0! px-2 pt-2" role="tablist" aria-label="INFO section" @keydown="key">
          <button
            v-for="s in shown"
            :id="`info-tab-${s.id}`"
            :key="s.id"
            role="tab"
            class="subtab"
            :class="{ on: s === current, 'font-normal!': term && !s.rows.length && s !== current }"
            :aria-selected="s === current"
            :tabindex="s === current ? 0 : -1"
            aria-controls="info-panel"
            @click="pick(s.id)"
          >
            {{ s.name }}
            <span class="font-normal tabular-nums">{{ s.rows.length }}</span>
          </button>
        </div>
        <div
          id="info-panel"
          ref="panel"
          class="scroll p-3"
          role="tabpanel"
          tabindex="0"
          :aria-labelledby="current && `info-tab-${current.id}`"
        >
          <template v-if="current?.rows.length">
            <div class="grid gap-x-5 gap-y-3" :class="columns.length > 1 ? 'xl:grid-cols-2' : ''">
              <dl v-for="(col, n) in columns" :key="n" class="kv self-start border border-line">
                <template v-for="[k, v] in col" :key="k">
                  <dt class="font-mono font-normal!">{{ k }}</dt>
                  <dd class="font-mono break-all">{{ v }}</dd>
                </template>
              </dl>
            </div>
          </template>
          <div v-else class="px-1 py-4 text-fg-muted">
            <template v-if="term">
              No field of {{ current?.name }} matches “{{ filter }}”.
              <template v-if="elsewhere.length">
                Found in:
                <button v-for="s in elsewhere" :key="s.id" class="act" @click="jump(s.id)">{{ s.name }} ({{ s.rows.length }})</button>
              </template>
            </template>
            <template v-else-if="current">{{ current.name }} has no fields on this server.</template>
            <template v-else>Redis returned no INFO.</template>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
