<script setup>
// One task: every field of the task, the payload and the result in the viewer, and the actions of its state.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Archive, ArrowLeft, Check, ChevronRight, Copy, Play, SearchX, Trash2, XCircle } from 'lucide-vue-next'
import { ACTIONS, getTask, taskAction } from '../api'
import { askConfirm } from '../dialogs'
import { toast } from '../toasts'
import { usePoll } from '../poll'
import { absolute, duration, highlight, isZeroTime, pretty, relative } from '../util'
import Empty from '../components/Empty.vue'
import ErrorNote from '../components/ErrorNote.vue'
import LoadingNote from '../components/LoadingNote.vue'

const route = useRoute()
const router = useRouter()
const readOnly = window.READ_ONLY
const qname = computed(() => route.params.qname)
const task = ref(null)
const here = route.path
const notFound = ref(false)
const now = ref(Date.now())
const { loaded, error, refresh } = usePoll(async () => {
  try {
    task.value = await getTask(qname.value, route.params.taskId)
    notFound.value = false
  } catch (e) {
    notFound.value = e.status === 404
    if (!notFound.value) throw e
    task.value = null
  }
  now.value = Date.now()
})

const when = (ts) => (isZeroTime(ts) || ts === '-' ? '—' : `${relative(ts, now.value)} (${absolute(ts)})`)
const fields = computed(() => {
  const t = task.value
  if (!t) return []
  return [
    ['ID', t.id, true],
    ['Type', t.type, true],
    ['Queue', t.queue],
    ['State', t.state],
    t.group && ['Group', t.group],
    ['Retried', `${t.retried} of ${t.max_retry}`],
    t.state === 'active' && ['Started', when(t.start_time)],
    ['Next process time', when(t.next_process_at)],
    ['Timeout', t.timeout_seconds ? duration(t.timeout_seconds) : '—'],
    ['Deadline', when(t.deadline)],
    ['Last failed', when(t.last_failed_at)],
    t.error_message && ['Last error', t.error_message, false, 'text-err'],
    t.state === 'completed' && ['Completed', when(t.completed_at)],
    t.state === 'completed' && ['Expires', t.ttl_seconds > 0 ? `in ${duration(t.ttl_seconds)}` : 'expired'],
    t.state === 'active' &&
      t.is_orphaned && ['Orphaned', 'yes — its worker stopped; it returns to pending when its lease expires', false, 'text-warn'],
  ].filter(Boolean)
})

const ICON = { run: Play, archive: Archive, delete: Trash2, cancel: XCircle }
async function act(verb) {
  const t = task.value
  if (
    verb === 'delete' &&
    !(await askConfirm(`Delete task ${t.id}? This cannot be undone.`, { title: 'Delete task', ok: 'Delete', danger: true }))
  )
    return
  try {
    await taskAction(t.queue, t.state, verb, t.id, t.group)
    toast.success(`Task ${verb === 'cancel' ? 'cancel sent' : verb === 'run' ? 'queued to run' : `${verb}d`}.`)
    if (route.path !== here) return // the viewer left while the action ran: no redirect, no reload
    if (verb === 'delete') router.push({ path: `/queues/${encodeURIComponent(t.queue)}`, query: { status: t.state } })
    else task.value = await getTask(t.queue, t.id)
  } catch (e) {
    toast.error(e.message)
  }
}

const copied = ref(false)
async function copyId() {
  try {
    await navigator.clipboard.writeText(task.value.id)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    toast.warn('The browser did not allow copying.')
  }
}
const back = () => (history.state?.back ? router.back() : router.push(`/queues/${encodeURIComponent(qname.value)}`))
</script>

<template>
  <LoadingNote v-if="!loaded" />
  <div v-else class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <button class="btn-ghost" @click="back"><ArrowLeft :size="13" aria-hidden="true" /> Back</button>
      <nav aria-label="Breadcrumb" class="flex items-center gap-1 text-[13px]">
        <router-link to="/" class="text-link hover:text-link-hover">Queues</router-link>
        <ChevronRight :size="14" class="text-fg-muted" aria-hidden="true" />
        <router-link
          :to="{ path: `/queues/${encodeURIComponent(qname)}`, query: task ? { status: task.state } : {} }"
          class="text-link hover:text-link-hover"
          >{{ qname }}</router-link
        >
        <ChevronRight :size="14" class="text-fg-muted" aria-hidden="true" />
        <span class="font-mono text-fg-strong">{{ route.params.taskId }}</span>
      </nav>
      <div v-if="task && !readOnly" class="ml-auto flex gap-(--toolbar-gap)">
        <button v-for="v in ACTIONS[task.state] || []" :key="v" :class="v === 'delete' ? 'btn-danger' : 'btn'" @click="act(v)">
          <component :is="ICON[v]" :size="13" aria-hidden="true" /> {{ v[0].toUpperCase() + v.slice(1) }}
        </button>
      </div>
    </div>

    <ErrorNote v-if="error" what="the task" :error="error" :stale="!!task" @retry="refresh" />
    <section v-if="notFound" class="card">
      <Empty :icon="SearchX" title="Task not found" hint="It may have been processed, deleted or expired." />
    </section>
    <div v-else-if="task" class="grid gap-4 lg:grid-cols-2">
      <section class="card">
        <h2 class="card-h">
          <span class="dot" :class="`st-${task.state}`" aria-hidden="true"></span>
          Task · {{ task.state }}
        </h2>
        <dl class="kv">
          <template v-for="[k, v, mono, cls] in fields" :key="k">
            <dt>{{ k }}</dt>
            <dd :class="[mono ? 'font-mono' : '', cls]">
              {{ v }}
              <button v-if="k === 'ID'" class="act ml-1" :aria-label="copied ? 'Copied' : 'Copy the task ID'" @click="copyId">
                <component :is="copied ? Check : Copy" :size="12" aria-hidden="true" />
              </button>
            </dd>
          </template>
        </dl>
      </section>
      <div class="space-y-4">
        <section class="card">
          <h2 class="card-h">Payload</h2>
          <pre class="code m-3 max-h-[50vh] overflow-auto" v-html="highlight(pretty(task.payload)) || '(empty)'"></pre>
        </section>
        <section v-if="task.state === 'completed'" class="card">
          <h2 class="card-h">Result</h2>
          <pre class="code m-3 max-h-[40vh] overflow-auto" v-html="highlight(pretty(task.result)) || '(empty)'"></pre>
        </section>
      </div>
    </div>
  </div>
</template>
