<script setup>
// A KPI card (the ad-manager Home cards): a colored stripe on top, a caption, a big value and an optional note.
// tone: a task state (active, retry…) or ok / err / warn / muted / strong.
import { ref, watch } from 'vue'

const props = defineProps({
  label: String,
  value: [String, Number],
  note: String,
  tone: { type: String, default: 'strong' },
  icon: [Object, Function],
})
const STATES = ['active', 'pending', 'aggregating', 'scheduled', 'retry', 'archived', 'completed']
// the number takes the tone's text color, as on the panel's Home cards (a state color is ≥ 3:1: large text)
const INK = { ok: 'text-ok', err: 'text-err', warn: 'text-warn', muted: 'text-fg-muted', strong: 'text-fg-strong' }

// the number pulses when a refresh changes it, so a change is seen at a glance (style.css .stat-bump)
const bump = ref(false)
watch(
  () => props.value,
  (now, before) => {
    if (before === undefined || now === before) return
    bump.value = false
    requestAnimationFrame(() => (bump.value = true))
  },
)
</script>

<template>
  <div class="card card-lift relative overflow-hidden p-3" :class="STATES.includes(tone) ? `st-${tone}` : ''">
    <!-- a style, not a class: a class built at runtime (bg-decor-${tone}) is not in Tailwind's output -->
    <span
      class="stat-stripe absolute inset-x-0 top-0 h-(--card-stripe)"
      :style="{ background: STATES.includes(tone) ? 'var(--st)' : `var(--color-decor-${tone})` }"
      aria-hidden="true"
    ></span>
    <component :is="icon" v-if="icon" :size="34" class="stat-icon absolute right-2 bottom-2 opacity-15" aria-hidden="true" />
    <div class="text-[11px] font-semibold text-fg-muted uppercase">{{ label }}</div>
    <div
      class="mt-1 truncate text-3xl font-semibold"
      :class="[INK[tone], { 'stat-bump': bump }]"
      @animationend="bump = false"
      :style="STATES.includes(tone) ? { color: 'var(--st)' } : {}"
    >
      {{ value }}
    </div>
    <div v-if="note" class="mt-0.5 text-[11px] text-fg-muted">{{ note }}</div>
  </div>
</template>
