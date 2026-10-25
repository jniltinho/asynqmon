// Toasts: top right, slide in, hide after 4 s, click to close.
import { reactive } from 'vue'

export const toastState = reactive({ items: [] })

let seq = 0

function push(kind, head, msg) {
  const id = ++seq
  toastState.items.push({ id, kind, head, msg, show: false })
  setTimeout(() => {
    const it = toastState.items.find((x) => x.id === id)
    if (it) it.show = true
  }, 30)
  setTimeout(() => {
    const it = toastState.items.find((x) => x.id === id)
    if (it) it.show = false
  }, 4000)
  setTimeout(() => closeToast(id), 4400)
}

export function closeToast(id) {
  const i = toastState.items.findIndex((x) => x.id === id)
  if (i >= 0) toastState.items.splice(i, 1)
}

export const toast = {
  success: (msg) => push('', 'Success', msg),
  error: (msg) => push('err', 'Error', msg),
  warn: (msg) => push('warn', 'Attention', msg),
}
