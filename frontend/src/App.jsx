import { useState, useRef, useEffect } from 'react'

const WELCOME_MESSAGE = {
  role: 'tutor',
  content:
    "Hello! I'm Teacher's Pet, your math tutor. Feel free to ask me any math question — I'll walk you through it step by step.",
}

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'student', content: question }])
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, session_id: sessionId }),
      })
      const data = await res.json()
      setSessionId(data.session_id)
      setMessages((prev) => [
        ...prev,
        { role: 'tutor', content: data.answer, isError: data.error },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          content:
            "I couldn't reach the server. Make sure the backend is running on port 8000 and try again.",
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50">
      <Header />

      {/* scrollable message list */}
      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((msg, i) => (
            <Bubble key={i} message={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={scrollRef} />
        </div>
      </section>

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={loading}
      />
    </div>
  )
}

/* ---------------------------------------------------------- header */
function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow-md">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <Avatar />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Teacher's Pet</h1>
          <p className="text-purple-200 text-sm">AI-Powered Math Tutor</p>
        </div>
      </div>
    </header>
  )
}

/* --------------------------------------------------------- avatar */
function Avatar() {
  return (
    <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold tracking-wider">TP</span>
    </div>
  )
}

/* ------------------------------------------------- message bubble */
function Bubble({ message }) {
  const isStudent = message.role === 'student'

  return (
    <div className={`flex items-end gap-2 ${isStudent ? 'flex-row-reverse' : ''}`}>
      {!isStudent && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-xs font-bold">TP</span>
        </div>
      )}

      <div
        className={[
          'max-w-[75%] px-4 py-2.5 shadow-sm',
          isStudent
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl rounded-br-sm'
            : message.isError
              ? 'bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm'
              : 'bg-white border border-gray-100 rounded-2xl rounded-bl-sm',
        ].join(' ')}
      >
        <p
          className={[
            'text-sm leading-relaxed whitespace-pre-wrap',
            isStudent
              ? 'text-white'
              : message.isError
                ? 'text-red-600'
                : 'text-gray-700',
          ].join(' ')}
        >
          {message.content}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ typing dots */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">TP</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-3">
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------- input bar */
function InputBar({ value, onChange, onSubmit, disabled }) {
  return (
    <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-4">
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask a math question..."
          disabled={disabled}
          className="flex-1 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </form>
    </div>
  )
}
