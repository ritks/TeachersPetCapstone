import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

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
        const profile = await _saveUserDoc(user)
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

  const _saveUserDoc = async (user, roleHint = null) => {
    const ref = doc(db, 'users', user.uid)
    const existingSnap = await getDoc(ref)
    const existing = existingSnap.exists() ? existingSnap.data() : null
    // Never auto-default to teacher. Role should come from existing profile
    // or explicit user intent from the selected login/register path.
    const role = existing?.role ?? roleHint ?? null

    const payload = {
      email: user.email || existing?.email || '',
      displayName: user.displayName || existing?.displayName || '',
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (role) payload.role = role

    await setDoc(
      ref,
      payload,
      { merge: true },
    )

    return {
      email: user.email || existing?.email || '',
      displayName: user.displayName || existing?.displayName || '',
      role: role || null,
      theme: existing?.theme || null,
    }
  }

  const login = async (email, password, roleHint = null) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const profile = await _saveUserDoc(cred.user, roleHint)
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
    const profile = await _saveUserDoc({ ...cred.user, displayName }, roleHint)
    setCurrentUser(cred.user)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const loginWithGoogle = async (roleHint = null) => {
    const cred = await signInWithPopup(auth, googleProvider)
    const profile = await _saveUserDoc(cred.user, roleHint)
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
