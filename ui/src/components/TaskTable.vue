<script setup>
// The tasks of one state of a queue: a page of rows with the state's columns, an inline payload / result viewer,
// row actions, a selection with batch actions and the "all" actions, each destructive one behind a confirmation.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Inbox,
  Play,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-vue-next'
import { ACTIONS, allAction, batchAction, listGroups, listTasks, taskAction } from '../api'
import { askConfirm } from '../dialogs'
import { toast } from '../toasts'
import { usePoll } from '../poll'
import { settings } from '../settings'
import { absolute, duration, highlight, num, pretty, relative, shortId } from '../util'
import Empty from './Empty.vue'
import ErrorNote from './ErrorNote.vue'
import LoadingNote from './LoadingNote.vue'

const props = defineProps({ qname: { type: String, required: true }, state: { type: String, required: true }, count: Number })
const emit = defineEmits(['changed'])
const router = useRouter()
const readOnly = window.READ_ONLY

const tasks = ref([])
const groups = ref([])
const group = ref(router.currentRoute.value.query.group || '')
const page = ref(1)
const selected = ref(new Set())
const open = ref(new Set()) // rows whose payload viewer is open
const now = ref(Date.now())
const switching = ref(false) // another page or group asked for: the rows shown belong to the previous one

const { loaded, error, refresh } = usePoll(async () => {
  if (props.state === 'aggregating') {
    groups.value = (await listGroups(props.qname)).groups || []
    if (!groups.value.some((g) => g.group === group.value)) group.value = groups.value[0]?.group || ''
    if (!group.value) {
      tasks.value = []
      switching.value = false
      return
    }
  }
  const want = { page: page.value, size: settings.pageSize, group: group.value }
  const r = await listTasks(props.qname, props.state, want)
  // a reply for a page or group left meanwhile is dropped (the refresh the change queued brings the right one)
  if (want.page !== page.value || want.size !== settings.pageSize || want.group !== group.value) return
  tasks.value = r.tasks || []
  switching.value = false
  now.value = Date.now()
  // drop selected tasks that left this page (run, deleted, moved on)
  const ids = new Set(tasks.value.map((t) => t.id))
  selected.value = new Set([...selected.value].filter((id) => ids.has(id)))
})

const total = computed(() =>
  props.state === 'aggregating' ? groups.value.find((g) => g.group === group.value)?.size || 0 : props.count || 0,
)
const pages = computed(() => Math.max(1, Math.ceil(total.value / settings.pageSize)))
watch([page, () => settings.pageSize, group], () => {
  selected.value = new Set()
  switching.value = true // hides the old rows, so no action reaches them
  refresh()
})
watch(pages, (n) => page.value > n && (page.value = n))
// the group goes to the URL, but only while this queue page is still the one shown (a late reply may set it after)
const here = router.currentRoute.value.path
watch(group, (g) => {
  const now = router.currentRoute.value
  if (now.path === here) router.replace({ query: { ...now.query, group: g || undefined } })
})

const COLS = {
  active: [
    ['started', 'Started'],
    ['deadline', 'Deadline'],
    ['status', 'Status'],
  ],
  pending: [['retried', 'Retried']],
  aggregating: [['group', 'Group']],
  scheduled: [['next', 'Runs']],
  retry: [
    ['next', 'Next retry'],
    ['error', 'Last error'],
    ['retried', 'Retried'],
  ],
  archived: [
    ['failed', 'Last failed'],
    ['error', 'Last error'],
  ],
  completed: [
    ['completed', 'Completed'],
    ['result', 'Result'],
    ['ttl', 'Expires'],
  ],
}
const cols = computed(() => COLS[props.state])
const actions = computed(() => (readOnly ? [] : ACTIONS[props.state]))
const colspan = computed(() => cols.value.length + 3 + (actions.value.length ? 2 : 0))
const ICON = { run: Play, archive: Archive, delete: Trash2, cancel: XCircle }

const allOnPage = computed(() => tasks.value.length > 0 && tasks.value.every((t) => selected.value.has(t.id)))
function toggleAll() {
  selected.value = allOnPage.value ? new Set() : new Set(tasks.value.map((t) => t.id))
}
// a new Set each time, so the refs trigger (the template passes the ref's name, not the unwrapped Set)
function toggle(name, id) {
  const r = name === 'open' ? open : selected
  const s = new Set(r.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  r.value = s
}

const busy = ref(false)
const PAST = { run: 'Queued to run', archive: 'Archived', delete: 'Deleted', cancel: 'Cancel sent to' }
async function run(fn, msg) {
  busy.value = true
  try {
    toast.success(msg(await fn()))
    selected.value = new Set()
    await refresh()
    emit('changed')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}
const plural = (n) => `${num(n)} task${n === 1 ? '' : 's'}`

// Each action takes the group when it is asked for: a refresh while its confirmation is open may switch the group
// (the chosen one emptied), and the action must still reach the group the confirmation named. The queue and the
// state are fixed for this component (it is keyed by them).
async function one(verb, t) {
  const g = group.value
  if (
    verb === 'delete' &&
    !(await askConfirm(`Delete task ${t.id}? This cannot be undone.`, { title: 'Delete task', ok: 'Delete', danger: true }))
  )
    return
  run(
    () => taskAction(props.qname, props.state, verb, t.id, g),
    () => `${PAST[verb]} task ${shortId(t.id)}.`,
  )
}
// the confirmation names what the action reaches: "… in queue "default"", "… of group "x" in queue "default""
const ask = (verb, what, title, g) =>
  askConfirm(
    `${verb[0].toUpperCase() + verb.slice(1)} ${what} ${props.state === 'aggregating' ? `of group "${g}" ` : ''}in queue "${props.qname}"?${verb === 'delete' ? ' This cannot be undone.' : ''}`,
    { title, ok: title, danger: verb === 'delete' },
  )
async function batch(verb) {
  const g = group.value
  const ids = [...selected.value]
  if (!(await ask(verb, `the ${plural(ids.length)} selected (${props.state})`, `${verb} selected`, g))) return
  run(
    () => batchAction(props.qname, props.state, verb, ids, g),
    (r) => {
      const failed = (r?.failed_ids || r?.error_ids || []).length
      return `${PAST[verb]} ${plural(ids.length - failed)}${failed ? `; ${num(failed)} failed` : ''}.`
    },
  )
}
async function all(verb) {
  const g = group.value
  if (!(await ask(verb, `all ${plural(total.value)} ${props.state}`, `${verb} all`, g))) return
  run(
    () => allAction(props.qname, props.state, verb, g),
    (r) => {
      const n = r?.deleted ?? r?.archived ?? r?.scheduled
      return n === undefined ? `${PAST[verb]} all ${props.state} tasks.` : `${PAST[verb]} ${plural(n)}.`
    },
  )
}

const term = ref('')
function find() {
  const id = term.value.trim()
  if (id) router.push(`/queues/${encodeURIComponent(props.qname)}/tasks/${encodeURIComponent(id)}`)
}
const detail = (t) => `/queues/${encodeURIComponent(props.qname)}/tasks/${encodeURIComponent(t.id)}`
const preview = (p) => (p || '').replace(/\s+/g, ' ')
const from = computed(() => (total.value ? (page.value - 1) * settings.pageSize + 1 : 0))
const to = computed(() => Math.min(total.value, page.value * settings.pageSize))
</script>

<template>
  <!-- a column that fills the queue card: toolbar, the task list (it scrolls), the pager -->
  <div class="flex grow basis-0 flex-col">
    <div class="flex flex-wrap items-center gap-(--toolbar-gap) border-b border-line bg-surface-2 px-3 py-2">
      <label v-if="state === 'aggregating'" class="flex items-center gap-2">
        <span class="text-[11px] font-semibold text-fg-muted uppercase">Group</span>
        <select v-model="group" class="inp w-56" :disabled="!groups.length">
          <option v-for="g in groups" :key="g.group" :value="g.group">{{ g.group }} ({{ num(g.size) }})</option>
        </select>
      </label>
      <form class="flex" role="search" @submit.prevent="find">
        <label class="relative w-64">
          <span class="sr-only">Find a task by ID</span>
          <Search :size="13" class="absolute top-1/2 left-2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input v-model="term" class="inp pl-7" placeholder="Find a task by ID…" />
        </label>
        <button class="btn-ghost" :disabled="!term.trim()">Open</button>
      </form>

      <div v-if="selected.size" class="flex flex-wrap items-center gap-(--toolbar-gap)" role="group" aria-label="Selected tasks">
        <span class="font-semibold text-fg-strong">{{ num(selected.size) }} selected</span>
        <button v-for="v in actions" :key="v" :class="v === 'delete' ? 'btn-danger' : 'btn'" :disabled="busy" @click="batch(v)">
          <component :is="ICON[v]" :size="13" aria-hidden="true" /> {{ v }}
        </button>
        <button class="btn-ghost" @click="selected = new Set()"><X :size="13" aria-hidden="true" /> clear</button>
      </div>
      <div v-else-if="actions.length && total" class="ml-auto flex flex-wrap gap-(--toolbar-gap)" role="group" aria-label="All tasks">
        <button v-for="v in actions" :key="v" :class="v === 'delete' ? 'btn-danger' : 'btn-ghost'" :disabled="busy" @click="all(v)">
          <component :is="ICON[v]" :size="13" aria-hidden="true" /> {{ v }} all
        </button>
      </div>
    </div>

    <ErrorNote v-if="error" what="the tasks" :error="error" :stale="tasks.length > 0" class="m-2" @retry="refresh" />
    <LoadingNote v-if="!loaded || (switching && !error)" />
    <Empty
      v-else-if="!tasks.length && !error"
      :icon="Inbox"
      :title="`No ${state} tasks`"
      :hint="state === 'aggregating' && !groups.length ? 'No group is aggregating tasks in this queue.' : 'This list refreshes on its own.'"
    />
    <!-- its own scroll box, so the sticky column heads stay in view -->
    <div v-else-if="tasks.length && !switching" class="scroll h-0 min-h-40 grow basis-0">
      <table class="grid-t border-0">
        <thead>
          <tr>
            <th v-if="actions.length" class="w-8">
              <input
                type="checkbox"
                :checked="allOnPage"
                :indeterminate="selected.size > 0 && !allOnPage"
                aria-label="Select every task of this page"
                @change="toggleAll"
              />
            </th>
            <th>ID</th>
            <th>Type</th>
            <th>Payload</th>
            <th v-for="[k, l] in cols" :key="k">{{ l }}</th>
            <th v-if="actions.length" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in tasks" :key="t.id">
            <tr :class="selected.has(t.id) ? 'sel bg-row-hover!' : ''">
              <td v-if="actions.length">
                <input
                  type="checkbox"
                  :checked="selected.has(t.id)"
                  :aria-label="`Select task ${t.id}`"
                  @change="toggle('selected', t.id)"
                />
              </td>
              <td class="font-mono whitespace-nowrap">
                <router-link :to="detail(t)" class="text-link hover:text-link-hover" :title="t.id">{{ shortId(t.id) }}</router-link>
              </td>
              <td class="font-mono whitespace-nowrap">{{ t.type }}</td>
              <td class="max-w-[360px]">
                <button
                  class="flex w-full cursor-pointer items-center gap-1 text-left font-mono text-[11.5px] text-fg-muted hover:text-fg"
                  :aria-expanded="open.has(t.id)"
                  :aria-label="`${open.has(t.id) ? 'Hide' : 'Show'} the payload of task ${shortId(t.id)}`"
                  @click="toggle('open', t.id)"
                >
                  <component :is="open.has(t.id) ? ChevronUp : ChevronDown" :size="12" class="shrink-0" aria-hidden="true" />
                  <span class="truncate">{{ preview(t.payload) || '(empty)' }}</span>
                </button>
              </td>
              <td v-for="[k] in cols" :key="k" :class="k === 'error' || k === 'result' ? 'max-w-[280px]' : 'whitespace-nowrap'">
                <template v-if="k === 'started'">
                  <span :title="absolute(t.start_time)">{{ relative(t.start_time, now) }}</span>
                </template>
                <template v-else-if="k === 'deadline'">
                  <span :title="absolute(t.deadline)">{{ relative(t.deadline, now) }}</span>
                </template>
                <template v-else-if="k === 'status'">
                  <span
                    class="tag"
                    :class="t.is_orphaned ? 'bg-warn-fill text-on-warn-fill' : 'bg-ok-soft text-on-ok-soft'"
                    :title="t.is_orphaned ? 'The worker processing it stopped; the task returns to pending after its lease expires.' : ''"
                    >{{ t.is_orphaned ? 'orphaned' : 'running' }}</span
                  >
                </template>
                <template v-else-if="k === 'retried'">{{ t.retried }} / {{ t.max_retry }}</template>
                <template v-else-if="k === 'group'">{{ t.group }}</template>
                <template v-else-if="k === 'next'">
                  <span :title="absolute(t.next_process_at)">{{ relative(t.next_process_at, now) }}</span>
                </template>
                <template v-else-if="k === 'failed'">
                  <span :title="absolute(t.last_failed_at)">{{ relative(t.last_failed_at, now) }}</span>
                </template>
                <template v-else-if="k === 'error'">
                  <span class="line-clamp-2 text-err" :title="t.error_message">{{ t.error_message || '—' }}</span>
                </template>
                <template v-else-if="k === 'completed'">
                  <span :title="absolute(t.completed_at)">{{ relative(t.completed_at, now) }}</span>
                </template>
                <template v-else-if="k === 'result'">
                  <span class="block truncate font-mono text-[11.5px]" :title="t.result">{{ preview(t.result) || '—' }}</span>
                </template>
                <template v-else-if="k === 'ttl'">{{ t.ttl_seconds > 0 ? `in ${duration(t.ttl_seconds)}` : 'expired' }}</template>
              </td>
              <td v-if="actions.length" class="text-right whitespace-nowrap">
                <button v-for="v in actions" :key="v" class="act" :disabled="busy" :aria-label="`${v} task ${t.id}`" @click="one(v, t)">
                  <component :is="ICON[v]" :size="13" aria-hidden="true" /> {{ v }}
                </button>
              </td>
            </tr>
            <tr v-if="open.has(t.id)" class="bg-surface!">
              <td :colspan="colspan" class="py-2">
                <div class="grid gap-2" :class="t.result ? 'lg:grid-cols-2' : ''">
                  <div>
                    <div class="lbl">Payload</div>
                    <pre class="code max-h-72 overflow-auto" v-html="highlight(pretty(t.payload))"></pre>
                  </div>
                  <div v-if="t.result">
                    <div class="lbl">Result</div>
                    <pre class="code max-h-72 overflow-auto" v-html="highlight(pretty(t.result))"></pre>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3 border-t border-line px-3 py-2 text-[12px] text-fg-muted">
      <label class="flex items-center gap-2">
        Rows per page
        <select v-model.number="settings.pageSize" class="inp w-20">
          <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <span class="tabular-nums" aria-live="polite">{{ num(from) }}–{{ num(to) }} of {{ num(total) }}</span>
      <div class="flex gap-1">
        <button class="btn-ghost px-2" :disabled="page <= 1" aria-label="First page" @click="page = 1">
          <ChevronsLeft :size="14" aria-hidden="true" />
        </button>
        <button class="btn-ghost px-2" :disabled="page <= 1" aria-label="Previous page" @click="page--">
          <ChevronLeft :size="14" aria-hidden="true" />
        </button>
        <button class="btn-ghost px-2" :disabled="page >= pages" aria-label="Next page" @click="page++">
          <ChevronRight :size="14" aria-hidden="true" />
        </button>
        <button class="btn-ghost px-2" :disabled="page >= pages" aria-label="Last page" @click="page = pages">
          <ChevronsRight :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
