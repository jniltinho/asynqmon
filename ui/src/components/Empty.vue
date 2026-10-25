<script setup>
// An empty state: an icon, a title and an optional hint, centered in a card or a table cell.
defineProps({ icon: [Object, Function], title: String, hint: String })
</script>

<template>
  <div class="flex flex-col items-center gap-1 px-4 py-8 text-center text-fg-muted">
    <component :is="icon" v-if="icon" :size="28" class="mb-1 opacity-60" aria-hidden="true" />
    <div class="text-[13px] font-semibold text-fg">{{ title }}</div>
    <div v-if="hint" class="max-w-md text-[12px]">{{ hint }}</div>
    <slot />
  </div>
</template>
