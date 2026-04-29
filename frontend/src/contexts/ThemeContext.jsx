import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'tp_theme'

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children, currentUser }) {
  const [theme, setTheme] = useState(() => {
    // Immediately apply whatever is in localStorage to avoid flash
    const stored = localStorage.getItem(STORAGE_KEY) || 'light'
    applyTheme(stored)
    return stored
  })

  // When the authenticated user changes, load their saved preference from Firestore.
  // When there is NO user (logged out / login page), always force light.
  useEffect(() => {
    if (!currentUser) {
      setTheme('light')
      applyTheme('light')
      return
    }

    const ref = doc(db, 'users', currentUser.uid)
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const saved = snap.data().theme
        if (saved) {
          setTheme(saved)
          applyTheme(saved)
          localStorage.setItem(STORAGE_KEY, saved)
        }
      }
    }).catch(() => {
      // Firestore unavailable — keep localStorage value
    })
    // Only run when the user identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid])

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), { theme: next }, { merge: true })
      } catch {
        // Non-critical — UI already updated
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
