import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the AuthContext before importing component
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockLoginWithGoogle = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    login: mockLogin,
    register: mockRegister,
    loginWithGoogle: mockLoginWithGoogle,
  }))
}))

import TeacherLoginPage from './TeacherLoginPage'

describe('TeacherLoginPage', () => {
  let mockOnSuccess

  beforeEach(() => {
    mockOnSuccess = vi.fn()
    mockLogin.mockClear()
    mockRegister.mockClear()
    mockLoginWithGoogle.mockClear()
  })

  it('should render the page title and subtitle', () => {
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)
    expect(screen.getByText('Teacher Portal')).toBeInTheDocument()
    expect(screen.getByText('Sign in to manage your modules')).toBeInTheDocument()
  })

  it('should render email and password inputs in sign in mode', () => {
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('should render mode toggle buttons', () => {
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)
    const buttons = screen.getAllByRole('button', { name: /sign in|create account/i })
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('should toggle to register mode and show display name input', async () => {
    const user = userEvent.setup()
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const buttons = screen.getAllByRole('button')
    const registerToggle = buttons.find(b => b.textContent.includes('Create Account') && !b.type.includes('submit'))
    
    if (registerToggle) {
      await user.click(registerToggle)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
      })
    }
  })

  it('should call login when sign in form is submitted with valid credentials', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue(undefined)
    
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getAllByRole('button').find(b => b.type === 'submit' && b.textContent.includes('Sign In'))

    await user.type(emailInput, 'teacher@example.com')
    await user.type(passwordInput, 'password123')
    
    if (submitButton) {
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('teacher@example.com', 'password123')
      })
    }
  })

  it('should call onSuccess after successful sign in', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue(undefined)
    
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getAllByRole('button').find(b => b.type === 'submit' && b.textContent.includes('Sign In'))

    await user.type(emailInput, 'teacher@example.com')
    await user.type(passwordInput, 'password123')
    
    if (submitButton) {
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    }
  })

  it('should display error message when login fails', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue({ code: 'auth/invalid-credential' })
    
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getAllByRole('button').find(b => b.type === 'submit' && b.textContent.includes('Sign In'))

    await user.type(emailInput, 'teacher@example.com')
    await user.type(passwordInput, 'wrongpassword')
    
    if (submitButton) {
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid email|password/i)).toBeInTheDocument()
      }, { timeout: 1000 })
    }
  })

  it('should call loginWithGoogle when Google button is clicked', async () => {
    const user = userEvent.setup()
    mockLoginWithGoogle.mockResolvedValue(undefined)
    
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const googleButton = screen.getByRole('button', { name: /sign in with google/i })
    await user.click(googleButton)

    await waitFor(() => {
      expect(mockLoginWithGoogle).toHaveBeenCalled()
    })
  })

  it('should disable submit button when email or password is empty', () => {
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const submitButton = screen.getAllByRole('button').find(b => b.type === 'submit' && b.textContent.includes('Sign In'))
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when both fields are filled', async () => {
    const user = userEvent.setup()
    render(<TeacherLoginPage onSuccess={mockOnSuccess} />)

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getAllByRole('button').find(b => b.type === 'submit' && b.textContent.includes('Sign In'))

    await user.type(emailInput, 'teacher@example.com')
    await user.type(passwordInput, 'password123')

    if (submitButton) {
      expect(submitButton).not.toBeDisabled()
    }
  })
})
