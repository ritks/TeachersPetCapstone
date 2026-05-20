import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { apiFetch } from '../lib/apiAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState(null)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null)
        setCurrentUserRole(null)
        setCurrentUserProfile(null)
        setAuthLoading(false)
        return
      }

      try {
        const profile = await _syncProfile(user)
        setCurrentUser(user)
        setCurrentUserProfile(profile)
        setCurrentUserRole(profile?.role || null)
      } catch {
        setCurrentUser(user)
        setCurrentUserProfile(null)
        setCurrentUserRole(null)
      } finally {
        setAuthLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const _syncProfile = async (user, roleHint = null) => {
    const body = {
      email: user.email || null,
      display_name: user.displayName || null,
    }
    if (roleHint) body.role = roleHint
    const data = await apiFetch('/me', { user, method: 'PUT', body })
    return {
      email: data.email || '',
      displayName: data.display_name || '',
      role: data.role || null,
      theme: data.theme || null,
    }
  }

  const login = async (email, password, roleHint = null) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const profile = await _syncProfile(cred.user, roleHint)
    setCurrentUser(cred.user)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const register = async (email, password, displayName, roleHint = null) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    const profile = await _syncProfile({ ...cred.user, displayName }, roleHint)
    setCurrentUser(cred.user)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const loginWithGoogle = async (roleHint = null) => {
    const cred = await signInWithPopup(auth, googleProvider)
    const profile = await _syncProfile(cred.user, roleHint)
    setCurrentUser(cred.user)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ currentUser, currentUserRole, currentUserProfile, authLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
