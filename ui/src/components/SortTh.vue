<script setup>
// A sortable column head: a button that sorts by the column (again: the other direction), aria-sort on the head.
import { ArrowDown, ArrowUp } from 'lucide-vue-next'

const props = defineProps({ label: String, by: String, sort: { type: Object, required: true } })
defineEmits(['sort'])
</script>

<template>
  <th :aria-sort="sort.key === props.by ? (sort.desc ? 'descending' : 'ascending') : undefined">
    <button class="inline-flex cursor-pointer items-center gap-1" @click="$emit('sort', props.by)">
      {{ label }}
      <component :is="sort.desc ? ArrowDown : ArrowUp" v-if="sort.key === props.by" :size="12" aria-hidden="true" />
    </button>
  </th>
</template>
