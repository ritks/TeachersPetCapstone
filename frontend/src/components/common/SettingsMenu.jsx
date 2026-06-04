import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { Button } from '../ui/primitives'
import {
  getTextSize,
  setTextSize as persistTextSize,
  TEXT_SIZES,
  TEXT_SIZE_LABELS,
} from '../../lib/textSize'

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function SettingsMenu({ onLogout, logoutLabel = 'Logout' }) {
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState(getTextSize)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const changeSize = (next) => {
    setSize(next)
    persistTextSize(next)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        onClick={() => setOpen((o) => !o)}
        variant="secondary"
        size="md"
        title="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
      >
        <GearIcon />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 z-50 rounded-xl border border-[var(--color-border-card-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)] p-3 flex flex-col gap-3"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1">
            Settings
          </p>

          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-sm text-[var(--color-text-primary)]">Theme</span>
            <button
              type="button"
              onClick={toggleTheme}
              role="switch"
              aria-checked={theme === 'dark'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className={[
                'relative w-28 h-7 rounded-full border transition-colors',
                theme === 'dark'
                  ? 'bg-[var(--color-brand-500)] border-[var(--color-brand-500)]'
                  : 'bg-[var(--color-bg-muted)] border-[var(--color-border-subtle)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow flex items-center justify-center text-[var(--color-text-secondary)] transition-all',
                  theme === 'light' ? 'left-0.5' : 'left-[calc(100%-1.625rem)]',
                ].join(' ')}
              >
                {theme === 'light' ? <SunIcon /> : <MoonIcon />}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-sm text-[var(--color-text-primary)]">Text size</span>
            <div className="w-28 flex gap-1 rounded-lg border border-[var(--color-border-subtle)] p-0.5">
              {TEXT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSize(s)}
                  aria-pressed={size === s}
                  aria-label={TEXT_SIZE_LABELS[s]}
                  title={TEXT_SIZE_LABELS[s]}
                  className={[
                    'flex-1 rounded-md py-1 leading-none transition-colors',
                    s === 'sm' ? 'text-[0.7rem]' : s === 'lg' ? 'text-base' : 'text-sm',
                    size === s
                      ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]',
                  ].join(' ')}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-md border border-[var(--color-danger-500)] px-1 py-1.5 text-center text-sm text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] transition-colors"
            >
              {logoutLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}