<script setup>
// The loading sign: a spinner (still when the system asks for less motion), "Loading…" only for screen readers.
import { LoaderCircle } from 'lucide-vue-next'
</script>

<template>
  <div role="status" class="flex items-center justify-center py-6 text-fg-muted">
    <LoaderCircle :size="20" class="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
    <span class="sr-only">Loading…</span>
  </div>
</template>
