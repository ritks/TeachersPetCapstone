import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeContext'

// apiFetch is used to load/persist the server-side theme; stub it out.
const apiFetchMock = vi.fn().mockResolvedValue({ theme: 'light' })
vi.mock('../lib/apiAuth', () => ({
  apiFetch: (...args) => apiFetchMock(...args),
}))

function Consumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  )
}

const renderProvider = (props = {}) =>
  render(
    <ThemeProvider authLoading={false} {...props}>
      <Consumer />
    </ThemeProvider>
  )

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  apiFetchMock.mockClear()
  apiFetchMock.mockResolvedValue({ theme: 'light' })
})

describe('ThemeContext', () => {
  it('defaults to light when there is no current user', () => {
    renderProvider({ currentUser: null })
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('uses the profile theme for a signed-in user', async () => {
    // Server returns the same value so the theme stays stable after refresh.
    apiFetchMock.mockResolvedValue({ theme: 'dark' })
    renderProvider({
      currentUser: { uid: 'u1' },
      currentUserProfile: { theme: 'dark' },
    })
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
  })

  it('toggles theme and persists to localStorage', async () => {
    const user = userEvent.setup()
    renderProvider({ currentUser: null })

    await user.click(screen.getByRole('button', { name: 'toggle' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('tp_theme')).toBe('dark')
  })

  it('persists the toggled theme to the server for a signed-in user', async () => {
    const user = userEvent.setup()
    const currentUser = { uid: 'u1' }
    renderProvider({ currentUser, currentUserProfile: { theme: 'light' } })

    // Flush the mount effect (GET /me) before toggling.
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/me', expect.objectContaining({ user: currentUser }))
    )
    apiFetchMock.mockClear()

    await user.click(screen.getByRole('button', { name: 'toggle' }))

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/me',
      expect.objectContaining({ method: 'PUT', body: { theme: 'dark' } })
    )
  })
})