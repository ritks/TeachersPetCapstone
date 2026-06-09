import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { apiFetch } from '../lib/apiAuth'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../firebase', () => ({ auth: {}, googleProvider: {} }))
vi.mock('../lib/apiAuth', () => ({ apiFetch: vi.fn() }))

function Consumer() {
  const { currentUser, currentUserRole, authLoading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(authLoading)}</span>
      <span data-testid="user">{currentUser ? currentUser.email : 'none'}</span>
      <span data-testid="role">{currentUserRole || 'none'}</span>
      <button onClick={() => login('a@b.c', 'pw', 'teacher')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  )

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no auth listener callback fired unless a test sets one.
  onAuthStateChanged.mockImplementation(() => () => {})
})

describe('AuthContext', () => {
  it('clears state and stops loading when signed out', async () => {
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null)
      return () => {}
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(screen.getByTestId('role')).toHaveTextContent('none')
  })

  it('syncs the profile when the auth listener reports a user', async () => {
    apiFetch.mockResolvedValue({ email: 'kid@b.c', display_name: 'Kid', role: 'student', theme: 'light' })
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: 'u1', email: 'kid@b.c', displayName: 'Kid' })
      return () => {}
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('student'))
    expect(screen.getByTestId('user')).toHaveTextContent('kid@b.c')
    expect(apiFetch).toHaveBeenCalledWith('/me', expect.objectContaining({ method: 'PUT' }))
  })

  it('login authenticates, syncs profile, and sets the role', async () => {
    const user = userEvent.setup()
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 't1', email: 'a@b.c' } })
    apiFetch.mockResolvedValue({ email: 'a@b.c', display_name: 'T', role: 'teacher', theme: null })

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('teacher'))
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.c', 'pw')
    expect(screen.getByTestId('user')).toHaveTextContent('a@b.c')
  })

  it('logout delegates to firebase signOut', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(signOut).toHaveBeenCalled()
  })
})