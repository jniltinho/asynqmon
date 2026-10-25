// Themed replacements of confirm(): every helper returns a Promise<boolean> and drives PanelDialogs.vue.
//   askConfirm(msg, {title, ok, danger})        a yes/no question
//   confirmTyped(msg, expected, {title, ok})   the button enables only when the typed text matches (destructive)
import { reactive } from 'vue'

export const dialogState = reactive({ confirm: null, typed: null })

export function askConfirm(msg, opts = {}) {
  return new Promise((resolve) => {
    dialogState.confirm = { title: opts.title || 'Confirmation', msg, ok: opts.ok || 'OK', danger: !!opts.danger, resolve }
  })
}

export function confirmTyped(msg, expected, opts = {}) {
  return new Promise((resolve) => {
    dialogState.typed = { title: opts.title || 'Safety confirmation', msg, expected, ok: opts.ok || 'Delete', value: '', resolve }
  })
}
