// HTTP API of the asynqmon Go handler (handler.go). Every call goes to <root path>/api; an error reply becomes an
// Error with the server's message.
const e = encodeURIComponent

async function req(method, path, body) {
  const init = body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { method }
  const r = await fetch(`${window.ROOT_PATH}/api${path}`, init)
  const text = await r.text()
  if (!r.ok) throw Object.assign(new Error(text.trim() || `${r.status} ${r.statusText}`), { status: r.status })
  return text ? JSON.parse(text) : null
}
const get = (path) => req('GET', path)
const post = (path, body) => req('POST', path, body)
const del = (path) => req('DELETE', path)

// The task states in queue order; "aggregating" tasks live under a group.
export const STATES = ['active', 'pending', 'aggregating', 'scheduled', 'retry', 'archived', 'completed']

// tasksPath is the collection of one state: /queues/q/pending_tasks, /queues/q/groups/g/aggregating_tasks…
export const tasksPath = (qname, state, group) =>
  state === 'aggregating' ? `/queues/${e(qname)}/groups/${e(group)}/aggregating_tasks` : `/queues/${e(qname)}/${state}_tasks`

// The actions each state accepts (handler.go): one task, a selection (batch) and every task of the state (all).
export const ACTIONS = {
  active: ['cancel'],
  pending: ['archive', 'delete'],
  aggregating: ['run', 'archive', 'delete'],
  scheduled: ['run', 'archive', 'delete'],
  retry: ['run', 'archive', 'delete'],
  archived: ['run', 'delete'],
  completed: ['delete'],
}

export const listQueues = () => get('/queues')
export const getQueue = (q) => get(`/queues/${e(q)}`)
export const deleteQueue = (q) => del(`/queues/${e(q)}`)
export const pauseQueue = (q) => post(`/queues/${e(q)}:pause`)
export const resumeQueue = (q) => post(`/queues/${e(q)}:resume`)
export const listQueueStats = () => get('/queue_stats')
export const listGroups = (q) => get(`/queues/${e(q)}/groups`)
export const getTask = (q, id) => get(`/queues/${e(q)}/tasks/${e(id)}`)

export const listTasks = (q, state, { page, size, group } = {}) => get(`${tasksPath(q, state, group)}?page=${page || 1}&size=${size || 20}`)

// taskAction runs an action on one task: DELETE …/id, POST …/id:run|archive|cancel.
export const taskAction = (q, state, verb, id, group) =>
  verb === 'delete' ? del(`${tasksPath(q, state, group)}/${e(id)}`) : post(`${tasksPath(q, state, group)}/${e(id)}:${verb}`)
// batchAction runs it on a selection: POST …:batch_<verb> {task_ids}.
export const batchAction = (q, state, verb, ids, group) => post(`${tasksPath(q, state, group)}:batch_${verb}`, { task_ids: ids })
// allAction runs it on every task of the state: DELETE …:delete_all, POST …:run_all|archive_all|cancel_all.
export const allAction = (q, state, verb, group) =>
  verb === 'delete' ? del(`${tasksPath(q, state, group)}:delete_all`) : post(`${tasksPath(q, state, group)}:${verb}_all`)

export const listServers = () => get('/servers')
export const listSchedulerEntries = () => get('/scheduler_entries')
export const listEnqueueEvents = (id) => get(`/scheduler_entries/${e(id)}/enqueue_events`)
export const getRedisInfo = () => get('/redis_info')
export const getMetrics = (endtime, duration, queues) =>
  get(`/metrics?endtime=${endtime}&duration=${duration}${queues?.length ? `&queues=${e(queues.join(','))}` : ''}`)
