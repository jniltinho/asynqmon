<script setup>
// A failed load: what failed, the server's message, whether older data is still shown, and a retry.
import { RefreshCw } from 'lucide-vue-next'

defineProps({ what: String, error: String, stale: Boolean })
defineEmits(['retry'])
</script>

<template>
  <div class="card flex flex-wrap items-center gap-3 border-l-4 border-l-err px-3 py-2" role="alert">
    <p class="flex-1 text-err">
      Could not load {{ what }}: {{ error }}<span v-if="stale" class="text-fg-muted"> — showing the last data received.</span>
    </p>
    <button class="btn-ghost" @click="$emit('retry')"><RefreshCw :size="13" aria-hidden="true" /> Retry</button>
  </div>
</template>
