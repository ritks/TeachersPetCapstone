import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { STUDENT_LOGIN_COPY } from '../content/strings'
import { AppShell, Button, Input, Panel } from './ui/primitives'
import LogoMark from './common/LogoMark'

export default function StudentLoginPage({ onSuccess, embedded = false }) {
  const { login, register, loginWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await login(email, password, 'student')
      } else {
        await register(email, password, displayName.trim() || undefined, 'student')
      }
      onSuccess?.()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle('student')
      onSuccess?.()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div className="w-full max-w-sm">
      {!embedded && (
        <div className="text-center mb-8">
          <LogoMark containerClassName="w-14 h-14 rounded-2xl border border-[var(--color-brand-100)] mx-auto mb-3 p-1" />
          <h2 className="text-2xl font-bold text-gray-800">{STUDENT_LOGIN_COPY.title}</h2>
          <p className="text-gray-400 text-sm mt-1">{STUDENT_LOGIN_COPY.subtitle}</p>
        </div>
      )}

      <Panel className={embedded ? 'p-5 bg-white/92 backdrop-blur-sm border-indigo-100 shadow-[0_14px_32px_rgba(27,38,59,0.12)]' : 'p-6'}>
        {embedded && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800">{STUDENT_LOGIN_COPY.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{STUDENT_LOGIN_COPY.subtitle}</p>
          </div>
        )}

        <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
          <button
            onClick={() => { setMode('signin'); setError('') }}
            className={[
              'flex-1 rounded-md text-sm font-medium py-1.5 transition-all',
              mode === 'signin' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {STUDENT_LOGIN_COPY.signIn}
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={[
              'flex-1 rounded-md text-sm font-medium py-1.5 transition-all',
              mode === 'register' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {STUDENT_LOGIN_COPY.createAccount}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={STUDENT_LOGIN_COPY.displayNamePlaceholder}
            />
          )}

          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={STUDENT_LOGIN_COPY.emailPlaceholder}
            required
            autoComplete="email"
          />

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={STUDENT_LOGIN_COPY.passwordPlaceholder}
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          <Button type="submit" disabled={loading || !email || !password} variant="primary" size="lg" className="w-full mt-1">
            {loading ? STUDENT_LOGIN_COPY.wait : mode === 'signin' ? STUDENT_LOGIN_COPY.signIn : STUDENT_LOGIN_COPY.createAccount}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">{STUDENT_LOGIN_COPY.or}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <Button onClick={handleGoogle} disabled={loading} variant="secondary" size="lg" className="w-full bg-white">
          {STUDENT_LOGIN_COPY.googleSignIn}
        </Button>
      </Panel>
    </div>
  )

  if (embedded) return content

  return (
    <AppShell className="flex flex-col items-center justify-center px-4">
      {content}
    </AppShell>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
