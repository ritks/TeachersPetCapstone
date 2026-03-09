import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntryPage from './EntryPage'

describe('EntryPage', () => {
  it('should render the page title and subtitle', () => {
    render(<EntryPage onStudentEntry={() => {}} onTeacherEntry={() => {}} onGuestEntry={() => {}} />)
    expect(screen.getByText("Teacher's Pet")).toBeInTheDocument()
    expect(screen.getByText('AI-Powered Math Tutor')).toBeInTheDocument()
  })

  it('should render three entry option buttons', () => {
    render(<EntryPage onStudentEntry={() => {}} onTeacherEntry={() => {}} onGuestEntry={() => {}} />)
    expect(screen.getByRole('button', { name: /i'm a student/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i'm a teacher/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /just chat/i })).toBeInTheDocument()
  })

  it('should call onStudentEntry when student button is clicked', async () => {
    const user = userEvent.setup()
    const onStudentEntry = vi.fn()
    render(
      <EntryPage
        onStudentEntry={onStudentEntry}
        onTeacherEntry={() => {}}
        onGuestEntry={() => {}}
      />
    )
    
    const studentButton = screen.getByRole('button', { name: /i'm a student/i })
    await user.click(studentButton)
    expect(onStudentEntry).toHaveBeenCalledOnce()
  })

  it('should call onTeacherEntry when teacher button is clicked', async () => {
    const user = userEvent.setup()
    const onTeacherEntry = vi.fn()
    render(
      <EntryPage
        onStudentEntry={() => {}}
        onTeacherEntry={onTeacherEntry}
        onGuestEntry={() => {}}
      />
    )

    const teacherButton = screen.getByRole('button', { name: /i'm a teacher/i })
    await user.click(teacherButton)
    expect(onTeacherEntry).toHaveBeenCalledOnce()
  })

  it('should call onGuestEntry when guest button is clicked', async () => {
    const user = userEvent.setup()
    const onGuestEntry = vi.fn()
    render(
      <EntryPage
        onStudentEntry={() => {}}
        onTeacherEntry={() => {}}
        onGuestEntry={onGuestEntry}
      />
    )

    const guestButton = screen.getByRole('button', { name: /just chat/i })
    await user.click(guestButton)
    expect(onGuestEntry).toHaveBeenCalledOnce()
  })
})
