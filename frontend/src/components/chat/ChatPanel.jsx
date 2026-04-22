import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { CHAT_COPY } from '../../content/strings'
import { getSpeechSynthesis, stripForSpeech, pickBestVoice, loadVoices } from '../../lib/speech'
import { apiUrl } from '../../lib/api'
import { Button, Card, Input } from '../ui/primitives'
import LogoMark from '../common/LogoMark'

// eslint-disable-next-line react-refresh/only-export-components
export const WELCOME_MESSAGE = {
  role: 'tutor',
  content: CHAT_COPY.welcome,
}

const QUICK_ACTION_ICONS = [
  (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
]

const QUICK_ACTIONS = CHAT_COPY.quickActions.map((action, index) => ({
  ...action,
  icon: QUICK_ACTION_ICONS[index],
}))

function StudentEmptyState({ greeting, onQuickAction }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 select-none">
      <Card className="w-full max-w-4xl p-7 md:p-8 border-[rgba(65,90,119,0.22)] bg-[linear-gradient(145deg,rgba(248,249,250,0.95),rgba(232,240,249,0.86))] shadow-[0_18px_36px_rgba(27,38,59,0.14)]">
        <div className="flex flex-col items-center">
          <LogoMark containerClassName="w-16 h-16 rounded-2xl bg-[var(--color-brand-50)] border border-[var(--color-brand-100)] mb-5 p-1" />
          <h2 className="text-3xl font-semibold text-[var(--color-text-primary)] text-center mb-2">{greeting}</h2>
          <p className="text-[var(--color-text-secondary)] text-sm text-center mb-7 max-w-sm">
            {CHAT_COPY.emptyStateHelp}
          </p>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 w-full">
        {QUICK_ACTIONS.map((action) => (
          <Card
            key={action.title}
            interactive
            className="flex flex-col gap-2.5 p-4 text-left cursor-pointer border-[rgba(65,90,119,0.2)] bg-white/80 hover:-translate-y-0.5 transition-all"
            onClick={() => onQuickAction(action.response)}
          >
            <div className={`w-8 h-8 rounded-lg ${action.iconBg} ${action.iconColor} flex items-center justify-center`}>
              {action.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{action.title}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{action.subtitle}</p>
            </div>
          </Card>
        ))}
      </div>
      </Card>
    </div>
  )
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function InputBar({ value, onChange, onSubmit, disabled }) {
  const [listening, setListening] = useState(false)
  const [speechSupported] = useState(() => !!getSpeechRecognitionCtor())
  const recognitionRef = useRef(null)
  const prefixRef = useRef('')

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) return undefined

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const parts = []
      for (let i = 0; i < event.results.length; i += 1) {
        const t = event.results[i][0]?.transcript?.trim()
        if (t) parts.push(t)
      }
      const speech = parts.join(' ')
      const prefix = prefixRef.current.trimEnd()
      const combined =
        prefix && speech ? `${prefix} ${speech}` : (prefix || speech)
      onChange(combined)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [onChange])

  const toggleListen = () => {
    const rec = recognitionRef.current
    if (!rec || disabled) return

    if (listening) {
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
      setListening(false)
      return
    }

    prefixRef.current = value
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(true)
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto flex gap-2 items-center rounded-[1.1rem] border border-[rgba(65,90,119,0.2)] bg-[rgba(248,249,250,0.88)] backdrop-blur-md px-3 py-2 shadow-[0_10px_24px_rgba(27,38,59,0.14)]">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={CHAT_COPY.inputPlaceholder}
          disabled={disabled}
          className="flex-1 rounded-[var(--radius-pill)] px-5 py-2.5 disabled:opacity-50 bg-white/80 border-[rgba(65,90,119,0.22)]"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListen}
            disabled={disabled}
            title={listening ? CHAT_COPY.speechStop : CHAT_COPY.speechStart}
            aria-pressed={listening}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            className={[
              'flex-shrink-0 rounded-full p-2.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              listening
                ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-[rgba(65,90,119,0.24)] bg-white/80 text-[var(--color-text-secondary)] hover:bg-white',
            ].join(' ')}
          >
            {listening ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        )}
        <Button
          disabled={disabled || !value.trim()}
          type="submit"
          variant="primary"
          size="pill"
        >
          {CHAT_COPY.send}
        </Button>
      </form>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <LogoMark containerClassName="w-8 h-8 rounded-full bg-[var(--color-primary-700)] border border-[rgba(255,255,255,0.4)] flex-shrink-0 shadow-sm p-0.5" imgClassName="rounded-full" />
      <div className="bg-[rgba(248,249,250,0.9)] border border-[rgba(65,90,119,0.2)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-3">
          <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export function Bubble({ message }) {
  const isStudent = message.role === 'student'
  const canSpeak = !isStudent && !message.isError
  const [ttsSupported] = useState(() => !!getSpeechSynthesis())
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef(null)
  const voiceRef = useRef(null)

  useEffect(() => {
    const synth = getSpeechSynthesis()
    if (!synth) return
    let cancelled = false
    loadVoices(synth).then((voices) => {
      if (!cancelled) voiceRef.current = pickBestVoice(voices)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      const synth = getSpeechSynthesis()
      if (synth && utteranceRef.current) {
        synth.cancel()
      }
    }
  }, [])

  const handleToggleSpeak = () => {
    const synth = getSpeechSynthesis()
    if (!synth) return

    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      utteranceRef.current = null
      return
    }

    synth.cancel()

    const clean = stripForSpeech(message.content)
    if (!clean) return

    const utterance = new window.SpeechSynthesisUtterance(clean)
    if (voiceRef.current) {
      utterance.voice = voiceRef.current
      utterance.lang = voiceRef.current.lang
    }
    utterance.rate = 1.15
    utterance.pitch = 1
    utterance.onend = () => {
      setSpeaking(false)
      utteranceRef.current = null
    }
    utterance.onerror = () => {
      setSpeaking(false)
      utteranceRef.current = null
    }
    utteranceRef.current = utterance
    setSpeaking(true)
    synth.speak(utterance)
  }

  return (
    <div className={`flex items-end gap-2 ${isStudent ? 'flex-row-reverse' : ''}`}>
      {!isStudent && (
        <LogoMark containerClassName="w-8 h-8 rounded-full bg-[var(--color-primary-700)] border border-[rgba(255,255,255,0.38)] flex-shrink-0 shadow-sm p-0.5" imgClassName="rounded-full" />
      )}

      <div
        className={[
          'max-w-[75%] px-4 py-2.5 shadow-sm',
          isStudent
            ? 'bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-700)] rounded-2xl rounded-br-sm border border-[rgba(255,255,255,0.22)]'
            : message.isError
              ? 'bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm'
              : 'bg-[rgba(248,249,250,0.9)] border border-[rgba(65,90,119,0.2)] rounded-2xl rounded-bl-sm',
        ].join(' ')}
      >
        {isStudent ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">
            {message.content}
          </p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>

      {canSpeak && ttsSupported && (
        <button
          type="button"
          onClick={handleToggleSpeak}
          title={speaking ? 'Stop reading' : 'Read aloud'}
          aria-pressed={speaking}
          aria-label={speaking ? 'Stop reading tutor message' : 'Read tutor message aloud'}
          className={[
            'flex-shrink-0 self-end mb-1 rounded-full p-1.5 border transition-colors',
            speaking
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              : 'border-[rgba(65,90,119,0.2)] bg-white/80 text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-brand-600)]',
          ].join(' ')}
        >
          {speaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

export default function ChatPanel({ selectedModuleId, userType, studentData, sessionKey, initialMessages, onMessagesUpdate }) {
  const [messages, setMessages] = useState(initialMessages ?? [WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [greeting] = useState(
    () => CHAT_COPY.greetings[Math.floor(Math.random() * CHAT_COPY.greetings.length)]
  )
  const scrollRef = useRef(null)

  const initialMessagesRef = useRef(initialMessages)
  useEffect(() => { initialMessagesRef.current = initialMessages }, [initialMessages])

  useEffect(() => {
    if (sessionKey !== undefined) {
      setMessages(initialMessagesRef.current ?? [WELCOME_MESSAGE])
      setSessionId(null)
      setInput('')
    }
  }, [sessionKey])

  useEffect(() => {
    if (sessionKey === undefined) {
      setMessages([WELCOME_MESSAGE])
      setSessionId(null)
    }
  }, [selectedModuleId, sessionKey])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    const withQuestion = [...messages, { role: 'student', content: question }]
    setMessages(withQuestion)
    setLoading(true)

    try {
      const body = { question, session_id: sessionId }
      if (selectedModuleId) body.module_id = selectedModuleId

      const res = await fetch(apiUrl('/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.detail || 'Chat request failed')
      }
      setSessionId(data.session_id)
      const finalMessages = [...withQuestion, { role: 'tutor', content: data.answer, isError: data.error }]
      setMessages(finalMessages)
      if (onMessagesUpdate) onMessagesUpdate(finalMessages, data.session_id)

      if (userType === 'student' && studentData) {
        addDoc(collection(db, 'prompts'), {
          courseCode: studentData.courseCode ?? null,
          moduleId: selectedModuleId ?? null,
          moduleName: studentData.moduleName ?? null,
          teacherUid: studentData.teacherUid ?? null,
          sessionId: data.session_id,
          prompt: question,
          response: data.answer,
          flagCategory: data.flag_category ?? null,
          flagSeverity: data.flag_severity ?? null,
          timestamp: serverTimestamp(),
        }).catch(() => { /* swallow */ })
      }
    } catch {
      const errMessages = [
        ...withQuestion,
        {
          role: 'tutor',
          content: CHAT_COPY.serverError,
          isError: true,
        },
      ]
      setMessages(errMessages)
      if (onMessagesUpdate) onMessagesUpdate(errMessages, sessionId)
      if (userType === 'student' && studentData) {
        addDoc(collection(db, 'prompts'), {
          courseCode: studentData.courseCode ?? null,
          moduleId: selectedModuleId ?? null,
          moduleName: studentData.moduleName ?? null,
          teacherUid: studentData.teacherUid ?? null,
          sessionId: sessionId ?? null,
          prompt: question,
          response: CHAT_COPY.serverError,
          flagCategory: 'system_error',
          flagSeverity: 'high',
          timestamp: serverTimestamp(),
        }).catch(() => { /* swallow */ })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (response) => {
    const newMsgs = [{ role: 'tutor', content: response }]
    setMessages(newMsgs)
    if (onMessagesUpdate) onMessagesUpdate(newMsgs, sessionId)
  }

  const isStudentEmptyState =
    userType === 'student' &&
    messages.length === 1 &&
    messages[0].content === WELCOME_MESSAGE.content

  return (
    <>
      <section className="flex-1 overflow-y-auto px-4 py-6 bg-[linear-gradient(160deg,rgba(248,249,250,0.96),rgba(231,239,248,0.78))]">
        {isStudentEmptyState ? (
          <StudentEmptyState greeting={greeting} onQuickAction={handleQuickAction} />
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg, i) => (
              <Bubble key={i} message={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={scrollRef} />
          </div>
        )}
      </section>

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={loading}
      />
      {userType === 'student' && (
        <p className="text-center text-xs text-[var(--color-text-muted)] pb-2 px-4">
          {CHAT_COPY.reviewNotice}
        </p>
      )}
    </>
  )
}
