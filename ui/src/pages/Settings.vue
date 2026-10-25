<script setup>
// Viewer settings (this browser only): theme, flat look, refresh interval and table rows.
import { hostTheme, settings, themeOf } from '../settings'
import { themes } from '../themes/registry'

const prometheus = window.PROMETHEUS_SERVER_ADDRESS
const readOnly = window.READ_ONLY
</script>

<template>
  <div class="grid max-w-5xl gap-5 lg:grid-cols-[2fr_1fr]">
    <section v-if="hostTheme" class="card lg:row-span-3">
      <h2 class="card-h">Theme</h2>
      <dl class="kv">
        <dt>Theme</dt>
        <dd>{{ hostTheme.id === 'auto' ? `Automatic (follows the system): ${themeOf('auto').label}` : themeOf(hostTheme.id).label }}</dd>
        <dt>Flat look</dt>
        <dd>{{ hostTheme.flat ? 'on' : 'off' }}</dd>
      </dl>
      <p class="border-t border-line px-3 py-2 text-[11px] text-fg-muted">Set by the application asynqmon runs in.</p>
    </section>
    <section v-else class="card lg:row-span-3">
      <h2 class="card-h">Theme</h2>
      <fieldset class="p-3">
        <legend class="sr-only">Theme</legend>
        <div class="grid gap-1 sm:grid-cols-2">
          <label
            v-for="t in [{ id: 'auto', label: 'Automatic (follows the system)', scheme: 'Default / Grafana' }, ...themes]"
            :key="t.id"
            class="flex cursor-pointer items-center gap-2 border px-2 py-1.5"
            :class="settings.theme === t.id ? 'border-field-focus bg-row-hover' : 'border-line-soft hover:bg-row-hover'"
          >
            <input v-model="settings.theme" type="radio" name="theme" :value="t.id" />
            <span class="flex-1">{{ t.label }}</span>
            <span class="text-[11px] text-fg-muted">{{ t.scheme }}</span>
          </label>
        </div>
        <label class="mt-3 flex cursor-pointer items-center gap-2 border-t border-line pt-3">
          <input v-model="settings.flat" type="checkbox" />
          <span>
            <span class="font-semibold">Flat look</span>
            <span class="block text-[11px] text-fg-muted">No gradients or shadows, in any theme.</span>
          </span>
        </label>
      </fieldset>
    </section>

    <section class="card">
      <h2 class="card-h">Refresh</h2>
      <div class="space-y-3 p-3">
        <label class="block">
          <span class="lbl">Every {{ settings.pollInterval }} second{{ settings.pollInterval === 1 ? '' : 's' }}</span>
          <input v-model.number="settings.pollInterval" type="range" min="2" max="20" step="1" class="w-full accent-(--color-action)" />
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input v-model="settings.live" type="checkbox" />
          Refresh automatically
        </label>
      </div>
    </section>

    <section class="card">
      <h2 class="card-h">Tables</h2>
      <label class="flex items-center justify-between gap-2 p-3">
        Task rows per page
        <select v-model.number="settings.pageSize" class="inp w-24">
          <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
    </section>

    <section class="card">
      <h2 class="card-h">Server</h2>
      <dl class="kv">
        <dt>Mode</dt>
        <dd>{{ readOnly ? 'read-only' : 'read and write' }}</dd>
        <dt>Prometheus</dt>
        <dd class="break-all">{{ prometheus || 'not configured (--prometheus-addr)' }}</dd>
      </dl>
      <p class="border-t border-line px-3 py-2 text-[11px] text-fg-muted">These settings are kept in this browser only.</p>
    </section>
  </div>
</template>
