import { describe, it, expect, beforeEach } from 'vitest'
import { getTextSize, setTextSize, applyTextSize } from './textSize'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-text-size')
})

describe('textSize', () => {
  it('defaults to "md" when nothing is stored', () => {
    expect(getTextSize()).toBe('md')
  })

  it('returns a stored valid size', () => {
    localStorage.setItem('tp_text_size', 'lg')
    expect(getTextSize()).toBe('lg')
  })

  it('falls back to "md" for an invalid stored value', () => {
    localStorage.setItem('tp_text_size', 'xl')
    expect(getTextSize()).toBe('md')
  })

  it('persists and applies a valid size', () => {
    setTextSize('sm')
    expect(localStorage.getItem('tp_text_size')).toBe('sm')
    expect(document.documentElement.getAttribute('data-text-size')).toBe('sm')
  })

  it('ignores invalid sizes', () => {
    setTextSize('huge')
    expect(localStorage.getItem('tp_text_size')).toBeNull()
  })

  it('applyTextSize sets the document attribute', () => {
    applyTextSize('lg')
    expect(document.documentElement.getAttribute('data-text-size')).toBe('lg')
  })
})