/**
 * Helpers for the browser's built-in SpeechSynthesis API,
 * used by the tutor voice-output feature.
 */

export function getSpeechSynthesis() {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis || null
}

/**
 * Strip markdown and LaTeX syntax from a tutor response so the
 * text-to-speech engine reads the actual content instead of symbols
 * like "asterisk asterisk" or "dollar sign".
 */
export function stripForSpeech(text) {
  if (!text) return ''

  let out = text

  // Block math: $$...$$ and \[...\]
  out = out.replace(/\$\$[\s\S]*?\$\$/g, ' ')
  out = out.replace(/\\\[[\s\S]*?\\\]/g, ' ')

  // Inline math: $...$ and \(...\)
  out = out.replace(/\$[^$\n]+\$/g, ' ')
  out = out.replace(/\\\([^)]*\\\)/g, ' ')

  // Fenced code blocks
  out = out.replace(/```[\s\S]*?```/g, ' ')
  // Inline code
  out = out.replace(/`([^`]+)`/g, '$1')

  // Images: ![alt](url) -> alt
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Links: [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

  // Bold / italic / strike markers
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
  out = out.replace(/\*([^*]+)\*/g, '$1')
  out = out.replace(/__([^_]+)__/g, '$1')
  out = out.replace(/_([^_]+)_/g, '$1')
  out = out.replace(/~~([^~]+)~~/g, '$1')

  // Headings and blockquote markers at line start
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  out = out.replace(/^\s{0,3}>\s?/gm, '')

  // List bullets at line start
  out = out.replace(/^\s*[-*+]\s+/gm, '')
  out = out.replace(/^\s*\d+\.\s+/gm, '')

  // Collapse whitespace
  out = out.replace(/\s+/g, ' ').trim()

  return out
}
