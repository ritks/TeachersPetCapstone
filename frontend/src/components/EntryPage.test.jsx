import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import EntryPage from './EntryPage'

// Mock auth context so inline login forms don't crash without a provider
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
    currentUser: null,
    currentUserRole: null,
    authLoading: false,
  }),
}))

// Mock student context used by StudentEntryPage inside StudentLoginPage flow
vi.mock('../contexts/StudentContext', () => ({
  useStudent: () => ({
    studentData: null,
    setStudentData: vi.fn(),
    clearStudent: vi.fn(),
  }),
}))

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('EntryPage', () => {
  it('should render updated marketing copy', () => {
    renderWithRouter(<EntryPage onStudentEntry={() => {}} onTeacherEntry={() => {}} />)
    expect(screen.getByText(/log in to your classroom/i)).toBeInTheDocument()
    expect(screen.getByText(/where every math problem becomes an aha moment/i)).toBeInTheDocument()
  })

  it('should render only student and teacher entry buttons', () => {
    renderWithRouter(<EntryPage onStudentEntry={() => {}} onTeacherEntry={() => {}} />)
    expect(screen.getByRole('button', { name: /i'm a student/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i'm a teacher/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /just chat/i })).not.toBeInTheDocument()
  })

  it('should call onStudentEntry when student button is clicked', async () => {
    const user = userEvent.setup()
    const onStudentEntry = vi.fn()
    renderWithRouter(
      <EntryPage
        onStudentEntry={onStudentEntry}
        onTeacherEntry={() => {}}
      />
    )

    const studentButton = screen.getByRole('button', { name: /i'm a student/i })
    await user.click(studentButton)
    expect(onStudentEntry).toHaveBeenCalledOnce()
  })

  it('should call onTeacherEntry when teacher button is clicked', async () => {
    const user = userEvent.setup()
    const onTeacherEntry = vi.fn()
    renderWithRouter(
      <EntryPage
        onStudentEntry={() => {}}
        onTeacherEntry={onTeacherEntry}
      />
    )

    const teacherButton = screen.getByRole('button', { name: /i'm a teacher/i })
    await user.click(teacherButton)
    expect(onTeacherEntry).toHaveBeenCalledOnce()
  })

})
