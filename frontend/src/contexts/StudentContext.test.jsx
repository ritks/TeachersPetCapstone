import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentProvider, useStudent } from './StudentContext'

// Guest by default; individual tests can flip this before importing nothing else.
let mockCurrentUser = null
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ currentUser: mockCurrentUser }),
}))

function Consumer() {
  const { studentData, setStudentData, clearStudent } = useStudent()
  return (
    <div>
      <span data-testid="module">{studentData ? studentData.moduleId : 'none'}</span>
      <button onClick={() => setStudentData({ moduleId: 'm1' })}>set</button>
      <button onClick={clearStudent}>clear</button>
    </div>
  )
}

const renderProvider = () =>
  render(
    <StudentProvider>
      <Consumer />
    </StudentProvider>
  )

beforeEach(() => {
  mockCurrentUser = null
  localStorage.clear()
})

describe('StudentContext', () => {
  it('hydrates studentData from localStorage on load', () => {
    localStorage.setItem('tp_student', JSON.stringify({ moduleId: 'stored-mod' }))
    renderProvider()
    expect(screen.getByTestId('module')).toHaveTextContent('stored-mod')
  })

  it('ignores stored data without a moduleId', () => {
    localStorage.setItem('tp_student', JSON.stringify({ foo: 'bar' }))
    renderProvider()
    expect(screen.getByTestId('module')).toHaveTextContent('none')
  })

  it('persists studentData when set', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'set' }))

    expect(screen.getByTestId('module')).toHaveTextContent('m1')
    expect(JSON.parse(localStorage.getItem('tp_student'))).toEqual({ moduleId: 'm1' })
  })

  it('clears studentData and storage', async () => {
    const user = userEvent.setup()
    localStorage.setItem('tp_student', JSON.stringify({ moduleId: 'm1' }))
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'clear' }))

    expect(screen.getByTestId('module')).toHaveTextContent('none')
    expect(localStorage.getItem('tp_student')).toBeNull()
  })

  it('throws when useStudent is used outside a provider', () => {
    // Suppress React's expected error log for this render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(/within a StudentProvider/)
    spy.mockRestore()
  })
})