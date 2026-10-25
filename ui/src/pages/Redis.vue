<script setup>
// The Redis server (or cluster): the key numbers, the queue locations of a cluster and the full INFO, grouped by
// section with a filter.
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
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
const filter = ref('')
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
  const f = filter.value.trim().toLowerCase()
  return out
    .map((s) => ({ ...s, rows: f ? s.rows.filter(([k, v]) => k.includes(f) || v.toLowerCase().includes(f)) : s.rows }))
    .filter((s) => s.rows.length)
})
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="space-y-5">
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

      <section v-if="data.cluster" class="card">
        <h2 class="card-h">Queue locations</h2>
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
        <pre class="code m-3 max-h-64 overflow-auto">{{ data.raw_cluster_nodes }}</pre>
      </section>

      <section class="card">
        <h2 class="card-h justify-between">
          {{ data.cluster ? 'CLUSTER INFO' : 'INFO' }} · {{ data.address }}
          <label class="relative w-56 font-normal normal-case">
            <span class="sr-only">Filter INFO</span>
            <Search :size="13" class="absolute top-1/2 left-2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <input v-model="filter" class="inp pl-7" placeholder="Filter keys or values…" />
          </label>
        </h2>
        <p v-if="!sections.length" class="px-3 py-4 text-fg-muted">Nothing matches “{{ filter }}”.</p>
        <div class="grid gap-x-5 p-3 md:grid-cols-2 2xl:grid-cols-3">
          <div v-for="s in sections" :key="s.name" class="mb-4 break-inside-avoid">
            <h3 class="mb-1 text-[12px] font-semibold text-fg-strong">{{ s.name }}</h3>
            <dl class="kv border border-line">
              <template v-for="[k, v] in s.rows" :key="k">
                <dt class="font-mono font-normal!">{{ k }}</dt>
                <dd class="font-mono break-all">{{ v }}</dd>
              </template>
            </dl>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
