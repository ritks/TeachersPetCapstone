import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { apiFetch } from '../lib/apiAuth'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'tp_theme'
const THEMES = new Set(['light', 'dark'])

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function normalizeTheme(theme) {
  return THEMES.has(theme) ? theme : 'light'
}

export function ThemeProvider({ children, currentUser, currentUserProfile, authLoading, allowGuestTheme = false }) {
  const [refreshedTheme, setRefreshedTheme] = useState(null)
  const [guestTheme, setGuestTheme] = useState('light')

  const refreshedThemeForUser =
    currentUser && refreshedTheme?.uid === currentUser.uid
      ? refreshedTheme.theme
      : null
  const theme = currentUser
    ? normalizeTheme(refreshedThemeForUser || currentUserProfile?.theme)
    : (allowGuestTheme ? guestTheme : 'light')

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (authLoading || !currentUser) return
    apiFetch('/me', { user: currentUser })
      .then((data) => {
        const saved = normalizeTheme(data.theme)
        setRefreshedTheme({ uid: currentUser.uid, theme: saved })
        localStorage.setItem(STORAGE_KEY, saved)
      })
      .catch(() => {})
  }, [authLoading, currentUser])

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light'
    if (currentUser) {
      setRefreshedTheme({ uid: currentUser.uid, theme: next })
    } else if (allowGuestTheme) {
      setGuestTheme(next)
    }
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)

    if (currentUser) {
      try {
        await apiFetch('/me', { user: currentUser, method: 'PUT', body: { theme: next } })
      } catch {
        // UI already updated
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
