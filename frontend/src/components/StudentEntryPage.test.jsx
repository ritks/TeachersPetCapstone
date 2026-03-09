import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock firebase before importing component
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}))

import StudentEntryPage from './StudentEntryPage'
import { getDoc, doc } from 'firebase/firestore'

describe('StudentEntryPage', () => {
  let mockOnSuccess

  beforeEach(() => {
    mockOnSuccess = vi.fn()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should render the page title and subtitle', () => {
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)
    expect(screen.getByText('Join a Class')).toBeInTheDocument()
    expect(screen.getByText('Enter the code your teacher gave you')).toBeInTheDocument()
  })

  it('should render code input field with placeholder', () => {
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)
    const input = screen.getByDisplayValue('')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('placeholder', 'e.g. ABC123')
  })

  it('should render submit button', () => {
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)
    expect(screen.getByRole('button', { name: /join class/i })).toBeInTheDocument()
  })

  it('should convert input to uppercase', async () => {
    const user = userEvent.setup()
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    await user.type(input, 'abc123')

    expect(input.value).toBe('ABC123')
  })

  it('should disable submit button when code is empty', () => {
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)
    const button = screen.getByRole('button', { name: /join class/i })
    expect(button).toBeDisabled()
  })

  it('should enable submit button when code is entered', async () => {
    const user = userEvent.setup()
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'ABC123')

    expect(button).not.toBeDisabled()
  })

  it('should fetch and validate code from Firestore on submit', async () => {
    const user = userEvent.setup()
    const mockData = {
      moduleId: 'mod123',
      moduleName: 'Algebra 101',
      teacherUid: 'teacher1',
      teacherName: 'Mr. Smith',
    }

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockData,
    })

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'XYZ789')
    await user.click(button)

    await waitFor(() => {
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'courseCodes', 'XYZ789')
      expect(getDoc).toHaveBeenCalled()
    })
  })

  it('should display error when code does not exist', async () => {
    const user = userEvent.setup()

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    })

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'INVALID')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeInTheDocument()
    })
  })

  it('should display error when Firestore query fails', async () => {
    const user = userEvent.setup()

    vi.mocked(getDoc).mockRejectedValue(new Error('Network error'))

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'ABC123')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/could not verify the code/i)).toBeInTheDocument()
    })
  })

  it('should show loading state while verifying code', async () => {
    const user = userEvent.setup()

    vi.mocked(getDoc).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        exists: () => true,
        data: () => ({ moduleId: 'mod123', moduleName: 'Test' })
      }), 100))
    )

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'ABC123')
    await user.click(button)

    // Button should show loading state
    expect(screen.getByRole('button', { name: /checking/i })).toBeInTheDocument()
  })

  it('should limit code input to 6 characters max', () => {
    render(<StudentEntryPage onSuccess={mockOnSuccess} />)
    const input = screen.getByDisplayValue('')
    expect(input.maxLength).toBe(6)
  })

  it('should store student data in localStorage on success', async () => {
    const user = userEvent.setup()
    const mockData = {
      moduleId: 'mod123',
      moduleName: 'Algebra 101',
      teacherUid: 'teacher1',
      teacherName: 'Mr. Smith',
    }

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockData,
    })

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'ABC123')
    await user.click(button)

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('tp_student'))
      expect(stored).toEqual({
        courseCode: 'ABC123',
        moduleId: mockData.moduleId,
        moduleName: mockData.moduleName,
        teacherUid: mockData.teacherUid,
        teacherName: mockData.teacherName,
      })
    })
  })

  it('should call onSuccess with student data after successful validation', async () => {
    const user = userEvent.setup()
    const mockData = {
      moduleId: 'mod123',
      moduleName: 'Algebra 101',
      teacherUid: 'teacher1',
      teacherName: 'Mr. Smith',
    }

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockData,
    })

    render(<StudentEntryPage onSuccess={mockOnSuccess} />)

    const input = screen.getByDisplayValue('')
    const button = screen.getByRole('button', { name: /join class/i })

    await user.type(input, 'ABC123')
    await user.click(button)

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(expect.objectContaining({
        courseCode: 'ABC123',
        moduleId: mockData.moduleId,
      }))
    })
  })
})
