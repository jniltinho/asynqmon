<script setup>
// The window of the panel (the ad-manager layout): header with the product and the Redis server, top tabs, the page
// and a footer.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, Clock, Database, Github, ListChecks, MessageSquare, Pause, Play, Server, Settings, Timer } from 'lucide-vue-next'
import PanelDialogs from './components/PanelDialogs.vue'
import Logo from './components/Logo.vue'
import Toasts from './components/Toasts.vue'
import { getRedisInfo } from './api'
import { lastRefresh } from './poll'
import { settings } from './settings'

const route = useRoute()
const redis = ref(null)
const readOnly = window.READ_ONLY

const tabs = [
  ['/', 'Queues', ListChecks],
  ['/servers', 'Servers', Server],
  ['/schedulers', 'Schedulers', Clock],
  ['/redis', 'Redis', Database],
  ...(window.PROMETHEUS_SERVER_ADDRESS ? [['/q/metrics', 'Metrics', Activity]] : []),
  ['/settings', 'Settings', Settings],
]
const current = computed(() => route.meta.tab || route.path)

onMounted(async () => {
  try {
    redis.value = await getRedisInfo()
  } catch {
    // the header only loses the server line
  }
})

const refreshed = computed(() => lastRefresh.value?.toLocaleTimeString() || '—')
const scrollTop = () => document.querySelector('main')?.scrollTo(0, 0)
</script>

<template>
  <PanelDialogs />
  <Toasts />
  <div
    class="mx-auto flex h-(--view-h) w-full max-w-[1840px] flex-col overflow-hidden bg-surface text-fg shadow-(--shadow-app) outline outline-line sm:my-4 sm:h-[calc(var(--view-h)-32px)] sm:w-[calc(100%-32px)]"
  >
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-header bg-(image:--bg-header) px-5 py-3">
      <router-link to="/" class="shrink-0" aria-label="Asynqmon home"><Logo /></router-link>
      <div class="border-l-2 border-header-bar pl-3 leading-tight">
        <div class="text-[15px] font-semibold text-on-header">Task queue monitor</div>
        <div class="text-[11px] text-on-header-muted">
          <template v-if="redis">{{ redis.cluster ? 'Redis cluster' : 'Redis' }} {{ redis.address }}</template>
          <template v-else>asynq</template>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-3 text-[12px]">
        <span v-if="readOnly" class="tag bg-warn-fill text-on-warn-fill" title="Changes are disabled (--read-only)">read-only</span>
        <span class="hidden text-on-header-muted sm:inline" aria-live="off">
          <Timer :size="12" class="inline align-[-2px]" aria-hidden="true" />
          {{ settings.live ? `every ${settings.pollInterval}s` : 'paused' }} · {{ refreshed }}
        </span>
        <button
          class="btn-ghost"
          :aria-pressed="!settings.live"
          :title="settings.live ? 'Stop the automatic refresh' : 'Refresh automatically again'"
          @click="settings.live = !settings.live"
        >
          <component :is="settings.live ? Pause : Play" :size="13" aria-hidden="true" />
          {{ settings.live ? 'Pause' : 'Resume' }}
        </button>
      </div>
    </header>
    <nav class="top-tabs flex flex-wrap bg-tabs bg-(image:--bg-tabs) shadow-(--shadow-tabs)" aria-label="Main">
      <router-link
        v-for="[to, name, icon] in tabs"
        :key="to"
        :to="to"
        class="tab flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold transition-colors duration-150"
        :class="current === to ? 'on bg-tab-on bg-(image:--bg-tab-on) text-on-tab-on shadow-(--shadow-tab-on)' : 'bg-tab text-on-tab'"
        :aria-current="current === to ? 'page' : undefined"
      >
        <component :is="icon" :size="15" :class="current === to ? 'text-tab-on-icon' : ''" aria-hidden="true" />
        {{ name }}
      </router-link>
    </nav>
    <main class="min-h-0 flex-1 overflow-auto p-5">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in" @before-enter="scrollTop">
          <div :key="route.path" class="h-full">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>
    <footer
      class="app-footer flex flex-wrap items-center gap-y-1 border-t border-footer-bar bg-footer bg-(image:--bg-footer) px-5 py-2 text-[11px] text-on-footer"
    >
      <span class="font-semibold text-footer-strong">Asynqmon</span>
      <a
        href="https://github.com/jniltinho/asynqmon"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 hover:text-footer-strong"
        ><Github :size="12" aria-hidden="true" /> GitHub</a
      >
      <a
        href="https://github.com/jniltinho/asynqmon/issues"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 hover:text-footer-strong"
        ><MessageSquare :size="12" aria-hidden="true" /> Send feedback</a
      >
      <span v-if="redis" class="ml-auto inline-flex items-center gap-1"
        ><Database :size="12" aria-hidden="true" /> {{ redis.address }}
        <template v-if="redis.info?.redis_version"> · Redis {{ redis.info.redis_version }}</template></span
      >
    </footer>
  </div>
</template>
