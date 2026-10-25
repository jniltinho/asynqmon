<script setup>
// The global confirm and typed confirm (dialogs.js), as <dialog> with showModal (backdrop and focus trap).
import { computed, nextTick, ref, watch } from 'vue'
import { dialogState } from '../dialogs'

const dlgConfirm = ref(null)
const dlgTyped = ref(null)
const typedInput = ref(null)

watch(
  () => dialogState.confirm,
  async (v) => v && (await nextTick(), dlgConfirm.value?.showModal()),
)
watch(
  () => dialogState.typed,
  async (v) => v && (await nextTick(), dlgTyped.value?.showModal(), typedInput.value?.focus()),
)

const typedOk = computed(() => {
  const d = dialogState.typed
  return !!d && d.value.trim() === d.expected.trim()
})

// close() before the dialog leaves the DOM: the browser then gives the focus back to the button that opened it
function closeConfirm(ok) {
  dlgConfirm.value?.close()
  dialogState.confirm.resolve(ok)
  dialogState.confirm = null
}
function closeTyped(ok) {
  dlgTyped.value?.close()
  dialogState.typed.resolve(ok && typedOk.value)
  dialogState.typed = null
}
</script>

<template>
  <dialog
    v-if="dialogState.confirm"
    ref="dlgConfirm"
    class="pnl w-fit max-w-[min(560px,92vw)]"
    aria-labelledby="confirm-title"
    aria-describedby="confirm-msg"
    @cancel.prevent="closeConfirm(false)"
  >
    <h2 id="confirm-title" class="pnl-head">{{ dialogState.confirm.title }}</h2>
    <div id="confirm-msg" class="pnl-body whitespace-pre-line">{{ dialogState.confirm.msg }}</div>
    <div class="pnl-foot">
      <button type="button" :class="dialogState.confirm.danger ? 'btn-danger' : 'btn'" @click="closeConfirm(true)">
        {{ dialogState.confirm.ok }}
      </button>
      <button type="button" class="btn-ghost" autofocus @click="closeConfirm(false)">Cancel</button>
    </div>
  </dialog>

  <dialog
    v-if="dialogState.typed"
    ref="dlgTyped"
    class="pnl w-[440px] max-w-[92vw]"
    aria-labelledby="typed-title"
    aria-describedby="typed-msg"
    @cancel.prevent="closeTyped(false)"
  >
    <form @submit.prevent="closeTyped(true)">
      <h2 id="typed-title" class="pnl-head">{{ dialogState.typed.title }}</h2>
      <div class="pnl-body">
        <p id="typed-msg" class="mb-2 font-semibold text-err">{{ dialogState.typed.msg }}</p>
        <label class="mb-1 block" for="typed-confirm">
          Type <strong>{{ dialogState.typed.expected }}</strong> to confirm:
        </label>
        <input id="typed-confirm" ref="typedInput" v-model="dialogState.typed.value" class="inp" autocomplete="off" />
      </div>
      <div class="pnl-foot">
        <button type="submit" class="btn-danger" :disabled="!typedOk">{{ dialogState.typed.ok }}</button>
        <button type="button" class="btn-ghost" @click="closeTyped(false)">Cancel</button>
      </div>
    </form>
  </dialog>
</template>
