import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import './settings'
import App from './App.vue'

// Flags rendered by the Go server into index.html; an unevaluated template action (vp dev) means "not set".
const flag = (v) => (v === undefined || v.startsWith('/[[') ? '' : v)
window.ROOT_PATH = flag(window.FLAG_ROOT_PATH)
window.PROMETHEUS_SERVER_ADDRESS = flag(window.FLAG_PROMETHEUS_SERVER_ADDRESS)
window.READ_ONLY = flag(window.FLAG_READ_ONLY) === 'true'

// The same paths as the React UI (bookmarks keep working).
const router = createRouter({
  history: createWebHistory(`${window.ROOT_PATH}/`),
  routes: [
    { path: '/', component: () => import('./pages/Dashboard.vue'), meta: { title: 'Queues', tab: '/' } },
    { path: '/queues/:qname', component: () => import('./pages/Queue.vue'), meta: { title: 'Queue', tab: '/' } },
    { path: '/queues/:qname/tasks/:taskId', component: () => import('./pages/Task.vue'), meta: { title: 'Task', tab: '/' } },
    { path: '/servers', component: () => import('./pages/Servers.vue'), meta: { title: 'Servers' } },
    { path: '/schedulers', component: () => import('./pages/Schedulers.vue'), meta: { title: 'Schedulers' } },
    { path: '/redis', component: () => import('./pages/Redis.vue'), meta: { title: 'Redis' } },
    { path: '/q/metrics', component: () => import('./pages/Metrics.vue'), meta: { title: 'Metrics' } },
    { path: '/settings', component: () => import('./pages/Settings.vue'), meta: { title: 'Settings' } },
    { path: '/:p(.*)*', redirect: '/' },
  ],
})
router.afterEach((to) => (document.title = `${to.params.qname ? `${to.params.qname} · ` : ''}${to.meta.title} · Asynq Monitoring`))

createApp(App).use(router).mount('#app')
