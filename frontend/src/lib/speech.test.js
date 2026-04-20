import { describe, it, expect, afterEach, vi } from 'vitest'
import { getSpeechSynthesis, stripForSpeech, pickBestVoice } from './speech'

describe('stripForSpeech', () => {
  it('returns empty string for falsy input', () => {
    expect(stripForSpeech('')).toBe('')
    expect(stripForSpeech(null)).toBe('')
    expect(stripForSpeech(undefined)).toBe('')
  })

  it('removes bold and italic markers', () => {
    expect(stripForSpeech('This is **bold** and *italic*')).toBe('This is bold and italic')
    expect(stripForSpeech('__also bold__ and _also italic_')).toBe('also bold and also italic')
  })

  it('removes strikethrough markers', () => {
    expect(stripForSpeech('~~gone~~ text')).toBe('gone text')
  })

  it('removes inline code backticks but keeps text', () => {
    expect(stripForSpeech('use `x + y` here')).toBe('use x + y here')
  })

  it('removes fenced code blocks entirely', () => {
    const input = 'Before\n```python\nprint("hi")\n```\nAfter'
    expect(stripForSpeech(input)).toBe('Before After')
  })

  it('removes inline LaTeX math', () => {
    expect(stripForSpeech('The value is $x + 1$ today.')).toBe('The value is today.')
    expect(stripForSpeech('Inline \\(a+b\\) math')).toBe('Inline math')
  })

  it('removes block LaTeX math', () => {
    expect(stripForSpeech('Equation: $$x^2 + 1 = 0$$ end')).toBe('Equation: end')
    expect(stripForSpeech('Block \\[a=b\\] here')).toBe('Block here')
  })

  it('strips heading hashes but keeps heading text', () => {
    expect(stripForSpeech('# Heading one\nbody')).toBe('Heading one body')
    expect(stripForSpeech('### sub')).toBe('sub')
  })

  it('strips list bullets and numbers', () => {
    expect(stripForSpeech('- one\n- two\n- three')).toBe('one two three')
    expect(stripForSpeech('1. first\n2. second')).toBe('first second')
  })

  it('strips blockquote markers', () => {
    expect(stripForSpeech('> a quoted line')).toBe('a quoted line')
  })

  it('replaces markdown links with the link text', () => {
    expect(stripForSpeech('see [the docs](https://example.com)')).toBe('see the docs')
  })

  it('replaces markdown images with their alt text', () => {
    expect(stripForSpeech('![a diagram](d.png) caption')).toBe('a diagram caption')
  })

  it('collapses redundant whitespace', () => {
    expect(stripForSpeech('a   b\n\n\nc')).toBe('a b c')
  })

  it('handles a realistic tutor response with mixed formatting', () => {
    const input = "Great question! To solve **2x + 3 = 7**, subtract 3:\n\n$$2x = 4$$\n\nThen divide by 2 to get `x = 2`."
    const out = stripForSpeech(input)
    // Should not contain any markdown or latex punctuation
    expect(out).not.toMatch(/\*\*/)
    expect(out).not.toMatch(/\$/)
    expect(out).not.toMatch(/`/)
    expect(out).toContain('Great question')
    expect(out).toContain('2x + 3 = 7')
    expect(out).toContain('x = 2')
  })
})

describe('getSpeechSynthesis', () => {
  const originalSpeechSynthesis = window.speechSynthesis

  afterEach(() => {
    if (originalSpeechSynthesis === undefined) {
      delete window.speechSynthesis
    } else {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        writable: true,
        value: originalSpeechSynthesis,
      })
    }
  })

  it('returns the synthesis object when available on window', () => {
    const fake = { speak: vi.fn(), cancel: vi.fn() }
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: fake,
    })
    expect(getSpeechSynthesis()).toBe(fake)
  })

  it('returns null when speechSynthesis is not available', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    expect(getSpeechSynthesis()).toBeNull()
  })
})

describe('pickBestVoice', () => {
  it('returns null for empty or missing voice lists', () => {
    expect(pickBestVoice([])).toBeNull()
    expect(pickBestVoice(null)).toBeNull()
    expect(pickBestVoice(undefined)).toBeNull()
  })

  it('prefers "Natural" voices over plain ones', () => {
    const voices = [
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' },
    ]
    expect(pickBestVoice(voices).name).toBe('Microsoft Aria Online (Natural)')
  })

  it('prefers Google voices over legacy SAPI voices', () => {
    const voices = [
      { name: 'Microsoft Zira', lang: 'en-US' },
      { name: 'Google US English', lang: 'en-US' },
    ]
    expect(pickBestVoice(voices).name).toBe('Google US English')
  })

  it('filters to English voices when mixed with other languages', () => {
    const voices = [
      { name: 'Google Français', lang: 'fr-FR' },
      { name: 'Google Deutsch', lang: 'de-DE' },
      { name: 'Microsoft David', lang: 'en-US' },
    ]
    expect(pickBestVoice(voices).lang).toMatch(/^en/i)
  })

  it('falls back to any voice when no English voices are available', () => {
    const voices = [
      { name: 'Google Français', lang: 'fr-FR' },
      { name: 'Google Deutsch', lang: 'de-DE' },
    ]
    const picked = pickBestVoice(voices)
    expect(picked).not.toBeNull()
    expect(['fr-FR', 'de-DE']).toContain(picked.lang)
  })

  it('prefers Neural over Enhanced over plain', () => {
    const voices = [
      { name: 'Some Enhanced Voice', lang: 'en-US' },
      { name: 'Some Neural Voice', lang: 'en-US' },
      { name: 'Some Plain Voice', lang: 'en-US' },
    ]
    expect(pickBestVoice(voices).name).toBe('Some Neural Voice')
  })
})
