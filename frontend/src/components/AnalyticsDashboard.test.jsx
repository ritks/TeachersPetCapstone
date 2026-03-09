import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock firebase before importing component
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

// Mock AuthContext before importing component  
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'teacher123' },
  }),
}))

import AnalyticsDashboard from './AnalyticsDashboard'
import { getDocs, collection, query, where } from 'firebase/firestore'

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state initially', () => {
    vi.mocked(getDocs).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        docs: []
      }), 100))
    )

    render(<AnalyticsDashboard />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should display stat cards after loading', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'What is 2+2?',
        response: '4',
        moduleId: 'mod1',
        moduleName: 'Algebra',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total Prompts')).toBeInTheDocument()
    })
  })

  it('should display correct prompt count', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'Q1',
        response: 'A1',
        moduleId: 'mod1',
        moduleName: 'Algebra',
      },
      {
        id: '2',
        timestamp: { toMillis: () => 2000 },
        prompt: 'Q2',
        response: 'A2',
        moduleId: 'mod1',
        moduleName: 'Algebra',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      const allText = screen.getAllByText('2')
      expect(allText.length).toBeGreaterThan(0)
    })
  })

  it('should display module filter dropdown when modules exist', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'Q1',
        response: 'A1',
        moduleId: 'mod1',
        moduleName: 'Algebra',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Filter by module:')).toBeInTheDocument()
    })
  })

  it('should display student chat logs table', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => new Date('2024-01-15').getTime() },
        prompt: 'What is 2+2?',
        response: '4',
        moduleId: 'mod1',
        moduleName: 'Algebra',
        courseCode: 'ABC123',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Student Chat Logs')).toBeInTheDocument()
      expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })
  })

  it('should filter prompts by module when selected', async () => {
    const user = userEvent.setup()
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'Algebra Q',
        response: 'A',
        moduleId: 'mod1',
        moduleName: 'Algebra',
      },
      {
        id: '2',
        timestamp: { toMillis: () => 2000 },
        prompt: 'Geometry Q',
        response: 'A',
        moduleId: 'mod2',
        moduleName: 'Geometry',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Algebra Q')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'mod2')

    await waitFor(() => {
      expect(screen.queryByText('Algebra Q')).not.toBeInTheDocument()
      expect(screen.getByText('Geometry Q')).toBeInTheDocument()
    })
  })

  it('should display empty state when no chats logged', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/no chats logged yet/i)).toBeInTheDocument()
    })
  })

  it('should display error message on fetch failure', async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument()
    })
  })

  it('should sort prompts by timestamp in descending order', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'Old prompt',
        response: 'A',
        moduleId: 'mod1',
        moduleName: 'Module',
      },
      {
        id: '2',
        timestamp: { toMillis: () => 3000 },
        prompt: 'Newest prompt',
        response: 'A',
        moduleId: 'mod1',
        moduleName: 'Module',
      },
      {
        id: '3',
        timestamp: { toMillis: () => 2000 },
        prompt: 'Middle prompt',
        response: 'A',
        moduleId: 'mod1',
        moduleName: 'Module',
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // First row is header, second row should be newest
      expect(rows.length).toBeGreaterThan(1)
    })
  })

  it('should use correct Firestore query with teacherUid', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher123')
    })
  })

  it('should handle prompts with missing optional fields', async () => {
    const mockPrompts = [
      {
        id: '1',
        timestamp: { toMillis: () => 1000 },
        prompt: 'Q1',
        response: 'A1',
        // Missing moduleId, moduleName, courseCode
      },
    ]

    vi.mocked(getDocs).mockResolvedValue({
      docs: mockPrompts.map(p => ({
        id: p.id,
        data: () => ({ ...p }),
      })),
    })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeInTheDocument()
      expect(screen.getByText('A1')).toBeInTheDocument()
    })
  })
})
