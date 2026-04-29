import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { STUDENT_LOGIN_COPY } from '../content/strings'
import { AppShell, Button, Input, Panel } from './ui/primitives'
import LogoMark from './common/LogoMark'

export default function StudentLoginPage({ onSuccess, embedded = false }) {
  const { login, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
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
      navigate('/student')
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
      navigate('/student')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div className={embedded ? 'w-full max-w-none' : 'w-full max-w-sm'}>
      {!embedded && (
        <div className="text-center mb-8">
          <LogoMark containerClassName="w-14 h-14 rounded-2xl border border-[var(--color-brand-100)] mx-auto mb-3 p-1" />
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{STUDENT_LOGIN_COPY.title}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{STUDENT_LOGIN_COPY.subtitle}</p>
        </div>
      )}

      <Panel className={embedded ? 'p-5 bg-white/92 backdrop-blur-sm border-indigo-100 shadow-[var(--shadow-lg)]' : 'p-6'}>
        {embedded && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{STUDENT_LOGIN_COPY.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{STUDENT_LOGIN_COPY.subtitle}</p>
          </div>
        )}

        <div className="flex rounded-lg bg-[var(--color-bg-muted)] p-1 mb-5">
          <button
            onClick={() => { setMode('signin'); setError('') }}
            className={[
              'flex-1 rounded-md text-sm font-medium py-1.5 transition-all',
              mode === 'signin' ? 'bg-white text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {STUDENT_LOGIN_COPY.signIn}
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={[
              'flex-1 rounded-md text-sm font-medium py-1.5 transition-all',
              mode === 'register' ? 'bg-white text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
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
          <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
          <span className="text-xs text-[var(--color-text-muted)]">{STUDENT_LOGIN_COPY.or}</span>
          <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
        </div>

        <Button
          onClick={handleGoogle}
          disabled={loading}
          variant="secondary"
          size="lg"
          className="w-full flex items-center justify-center gap-2 bg-white"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
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
