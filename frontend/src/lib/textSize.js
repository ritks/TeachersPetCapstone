// Chat text-size preference (per-browser). Drives the --tp-chat-font CSS var
// via a data-text-size attribute on <html>; see index.css.

const STORAGE_KEY = 'tp_text_size'

export const TEXT_SIZES = ['sm', 'md', 'lg']
export const TEXT_SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' }

export function getTextSize() {
  const value = localStorage.getItem(STORAGE_KEY)
  return TEXT_SIZES.includes(value) ? value : 'md'
}

export function applyTextSize(size) {
  document.documentElement.setAttribute('data-text-size', size)
}

export function setTextSize(size) {
  if (!TEXT_SIZES.includes(size)) return
  localStorage.setItem(STORAGE_KEY, size)
  applyTextSize(size)
}

// Apply the persisted size eagerly on load so there's no flash.
applyTextSize(getTextSize())