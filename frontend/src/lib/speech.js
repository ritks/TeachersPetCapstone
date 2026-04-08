/**
 * Helpers for the browser's built-in SpeechSynthesis API,
 * used by the tutor voice-output feature.
 */

export function getSpeechSynthesis() {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis || null
}

/**
 * Pick the most natural-sounding English voice available.
 * Browsers ship a mix of old robotic voices (e.g. "Microsoft David")
 * and modern neural ones (e.g. "Microsoft Aria Online (Natural)",
 * "Google US English"). We rank by keywords that indicate quality.
 */
export function pickBestVoice(voices) {
  if (!voices || voices.length === 0) return null

  const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang))
  const pool = english.length > 0 ? english : voices

  const rank = (v) => {
    const name = (v.name || '').toLowerCase()
    let score = 0
    if (/natural/.test(name)) score += 100
    if (/neural/.test(name)) score += 100
    if (/online/.test(name)) score += 50
    if (/enhanced|premium/.test(name)) score += 40
    if (/google/.test(name)) score += 30
    if (/aria|jenny|guy|ava|samantha|nova/.test(name)) score += 20
    if (/en-us/i.test(v.lang)) score += 10
    // Penalize the old Microsoft SAPI voices
    if (/david|mark|zira|hazel/.test(name) && !/online/.test(name)) score -= 30
    return score
  }

  return [...pool].sort((a, b) => rank(b) - rank(a))[0] || null
}

/**
 * Resolve voices now, or wait for the `voiceschanged` event if the
 * browser hasn't loaded them yet (Chrome returns [] on first call).
 */
export function loadVoices(synth) {
  if (!synth) return Promise.resolve([])
  const existing = synth.getVoices()
  if (existing && existing.length > 0) return Promise.resolve(existing)
  return new Promise((resolve) => {
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler)
      resolve(synth.getVoices() || [])
    }
    synth.addEventListener('voiceschanged', handler)
    // Safety timeout — resolve with whatever's there after 1s
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler)
      resolve(synth.getVoices() || [])
    }, 1000)
  })
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
