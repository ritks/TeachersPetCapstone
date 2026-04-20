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
      setCurrentUser(user)
      if (!user) {
        setCurrentUserRole(null)
        setCurrentUserProfile(null)
        setAuthLoading(false)
        return
      }

      try {
        const profile = await _saveUserDoc(user)
        setCurrentUserProfile(profile)
        setCurrentUserRole(profile?.role || 'teacher')
      } catch {
        setCurrentUserProfile(null)
        setCurrentUserRole('teacher')
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
    const role = existing?.role || roleHint || 'teacher'

    await setDoc(
      ref,
      {
        email: user.email,
        displayName: user.displayName || '',
        role,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return {
      email: user.email || existing?.email || '',
      displayName: user.displayName || existing?.displayName || '',
      role,
    }
  }

  const login = async (email, password, roleHint = null) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setCurrentUser(cred.user)
    const profile = await _saveUserDoc(cred.user, roleHint)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const register = async (email, password, displayName, roleHint = null) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    setCurrentUser(cred.user)
    const profile = await _saveUserDoc({ ...cred.user, displayName }, roleHint)
    setCurrentUserRole(profile?.role || null)
    setCurrentUserProfile(profile)
    return cred.user
  }

  const loginWithGoogle = async (roleHint = null) => {
    const cred = await signInWithPopup(auth, googleProvider)
    setCurrentUser(cred.user)
    const profile = await _saveUserDoc(cred.user, roleHint)
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
