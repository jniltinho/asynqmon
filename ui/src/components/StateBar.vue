<script setup>
// The health of a queue at a glance: one segment per task state, its width the state's share of the queue.
import { computed } from 'vue'
import { STATES } from '../api'
import { num } from '../util'

const props = defineProps({ queue: { type: Object, required: true } })
const total = computed(() => STATES.reduce((n, s) => n + (props.queue[s] || 0), 0))
const text = computed(() =>
  STATES.filter((s) => props.queue[s])
    .map((s) => `${s} ${num(props.queue[s])}`)
    .join(', '),
)
</script>

<template>
  <div class="stackbar w-full min-w-24" role="img" :aria-label="text || 'empty'" :title="text || 'empty'">
    <template v-for="s in STATES" :key="s">
      <span v-if="queue[s]" :class="`st-${s}`" :style="{ width: `${(queue[s] / total) * 100}%` }"></span>
    </template>
  </div>
</template>
