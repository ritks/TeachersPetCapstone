import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CHAT_COPY } from '../../content/strings'
import ChatPanel from './ChatPanel'

// jsdom doesn't implement these layout methods the auto-scroll relies on.
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

const baseProps = {
  selectedModuleId: 'mod-1',
  userType: 'student',
  studentData: { moduleId: 'mod-1' },
  currentUser: null,
  sessionKey: 'sess-1',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChatPanel', () => {
  it('renders the student empty state with quick actions and input', () => {
    render(<ChatPanel {...baseProps} initialMessages={undefined} />)

    // A lone welcome message renders the student hero (quick actions), not a bubble.
    expect(screen.getByText(CHAT_COPY.quickActions[0].title)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(CHAT_COPY.inputPlaceholder)).toBeInTheDocument()
  })

  it('renders provided conversation history', () => {
    render(
      <ChatPanel
        {...baseProps}
        initialMessages={[
          { role: 'user', content: 'What is a fraction?' },
          { role: 'tutor', content: 'A fraction is part of a whole.' },
        ]}
      />
    )

    expect(screen.getByText('What is a fraction?')).toBeInTheDocument()
    expect(screen.getByText('A fraction is part of a whole.')).toBeInTheDocument()
  })

  it('sends the typed question to the chat API', async () => {
    // Pending promise: capture the request without driving the streaming UI.
    const fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<ChatPanel {...baseProps} initialMessages={undefined} />)

    const textarea = screen.getByPlaceholderText(CHAT_COPY.inputPlaceholder)
    await user.type(textarea, 'What is 2+2?{Enter}')

    // The student's message is echoed into the transcript immediately.
    expect(await screen.findByText('What is 2+2?')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toContain('/chat')
  })
})