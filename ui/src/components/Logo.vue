<script setup>
// The asynqmon logo: the queue mark (stacked tasks, the next one carried to a worker) and the name, drawn in the
// header's ink with the arrow in the theme's accent, so it fits every theme (no separate light and dark files).
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-on-header">
    <svg viewBox="0 0 32 32" class="h-10 w-10 shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M2 4h14v6H2zm0 9h10v6H2zm0 9h14v6H2z" />
      <path class="fill-header-bar" d="M16 13h6V8l8 8-8 8v-5h-6z" />
    </svg>
    <span class="text-[24px] leading-none tracking-tight">
      <span class="font-semibold">asynq</span><span class="text-on-header-muted">mon</span>
    </span>
  </span>
</template>
