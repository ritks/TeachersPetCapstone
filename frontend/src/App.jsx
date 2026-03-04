import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './contexts/AuthContext'
import EntryPage from './components/EntryPage'
import TeacherLoginPage from './components/TeacherLoginPage'
import StudentEntryPage from './components/StudentEntryPage'
import AnalyticsDashboard from './components/AnalyticsDashboard'

const WELCOME_MESSAGE = {
  role: 'tutor',
  content:
    "Hello! I'm Teacher's Pet, your math tutor. Feel free to ask me any math question — I'll walk you through it step by step.",
}

/* ── Student greeting bank ───────────────────────────────────── */
const GREETING_MESSAGES = [
  "Hey Math Wiz! What are we solving today?",
  "Good morning, fellow math enthusiast!",
  "Ready to crunch some numbers?",
  "Hello, future mathematician!",
  "Let's tackle some problems together!",
  "Great to see you! Math awaits.",
  "Hey there, problem solver!",
  "Time to make math click!",
  "Welcome! What shall we learn today?",
  "Let's make math make sense!",
]

/* ── Quick action cards ──────────────────────────────────────── */
const QUICK_ACTIONS = [
  {
    title: 'Homework Help',
    subtitle: 'Walk me through a problem',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    response: "Of course! Go ahead and type out your homework problem and I'll walk you through it step by step.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Practice Problems',
    subtitle: 'Give me something to solve',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
    response: "Let's practice! Tell me what topic you'd like to work on and I'll come up with a problem for you.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Explain a Concept',
    subtitle: 'Break it down simply',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-500',
    response: "Happy to explain! What concept would you like me to break down for you?",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    title: 'Study Tips',
    subtitle: 'Help me prepare',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-500',
    response: "Great thinking ahead! What subject or topic are you studying for? I'll share some tips to help you prepare.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
]

/* ── Student session helpers ─────────────────────────────────── */
function loadStudentSessions(courseCode) {
  try {
    const raw = localStorage.getItem(`tp_sessions_${courseCode}`)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveStudentSessions(courseCode, sessions) {
  try {
    localStorage.setItem(`tp_sessions_${courseCode}`, JSON.stringify(sessions))
  } catch { /* ignore */ }
}

function makeNewSession() {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    title: 'New Chat',
    messages: [WELCOME_MESSAGE],
    backendSessionId: null,
    createdAt: Date.now(),
  }
}

/* ── helpers ─────────────────────────────────────────────────── */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function getUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode()
    const snap = await getDoc(doc(db, 'courseCodes', code))
    if (!snap.exists()) return code
  }
  throw new Error('Could not generate a unique course code.')
}

/* ── App ─────────────────────────────────────────────────────── */
export default function App() {
  const { currentUser, authLoading, logout } = useAuth()

  // null | 'student' | 'teacher'
  const [userType, setUserType] = useState(null)
  const [studentData, setStudentData] = useState(null) // { courseCode, moduleId, moduleName, teacherUid }

  // Restore student session from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem('tp_student')
    if (raw) {
      try {
        const data = JSON.parse(raw)
        if (data?.courseCode && data?.moduleId) {
          setStudentData(data)
          setUserType('student')
          return
        }
      } catch { /* ignore */ }
    }
    // If Firebase has a logged-in user, go straight to teacher
    if (!authLoading && currentUser) {
      setUserType('teacher')
    }
  }, [authLoading, currentUser])

  // When Firebase resolves a logged-in user (e.g., after page reload)
  useEffect(() => {
    if (!authLoading && currentUser && userType === null) {
      setUserType('teacher')
    }
  }, [authLoading, currentUser, userType])

  if (authLoading) return <LoadingSpinner />

  if (userType === null) {
    return (
      <EntryPage
        onStudentEntry={() => setUserType('student')}
        onTeacherEntry={() => setUserType('teacher')}
        onGuestEntry={() => setUserType('guest')}
      />
    )
  }

  if (userType === 'teacher' && !currentUser) {
    return (
      <TeacherLoginPage
        onSuccess={() => { /* currentUser will update via onAuthStateChanged */ }}
      />
    )
  }

  if (userType === 'student' && !studentData) {
    return (
      <StudentEntryPage
        onSuccess={(data) => setStudentData(data)}
      />
    )
  }

  const handleLogout = async () => {
    if (userType === 'teacher') {
      await logout()
    } else {
      localStorage.removeItem('tp_student')
      setStudentData(null)
    }
    setUserType(null)
  }

  if (userType === 'teacher') {
    return (
      <TeacherApp
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    )
  }

  if (userType === 'guest') {
    return (
      <GuestApp onLeave={handleLogout} />
    )
  }

  // student
  return (
    <StudentApp
      studentData={studentData}
      onLogout={handleLogout}
    />
  )
}

/* ── TeacherApp ──────────────────────────────────────────────── */
function TeacherApp({ currentUser, onLogout }) {
  const [page, setPage] = useState('chat') // 'chat' | 'dashboard'
  const [modules, setModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documents, setDocuments] = useState([])

  const refreshDocuments = async (moduleId) => {
    const id = moduleId ?? selectedModuleId
    if (!id) { setDocuments([]); return }
    try {
      const res = await fetch(`http://localhost:8000/modules/${id}/documents`)
      const data = await res.json()
      setDocuments(data)
    } catch {
      setDocuments([])
    }
  }

  const refreshModules = async () => {
    try {
      const url = currentUser
        ? `http://localhost:8000/modules?teacher_uid=${encodeURIComponent(currentUser.uid)}`
        : 'http://localhost:8000/modules'
      const res = await fetch(url)
      const data = await res.json()
      setModules(data)
    } catch { /* ignore */ }
  }

  useEffect(() => { refreshModules() }, [currentUser])
  useEffect(() => { refreshDocuments(); }, [selectedModuleId])

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null

  if (page === 'dashboard') {
    return <TeacherDashboard onBack={() => setPage('chat')} onLogout={onLogout} currentUser={currentUser} />
  }

  return (
    <div className="flex flex-row h-screen bg-gray-50">
      <TeacherSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        modules={modules}
        selectedModuleId={selectedModuleId}
        onSelect={setSelectedModuleId}
        onModuleCreated={refreshModules}
        documents={documents}
        onDocumentsChanged={refreshDocuments}
        currentUser={currentUser}
        onModulesChanged={refreshModules}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TeacherHeader
          selectedModule={selectedModule}
          currentUser={currentUser}
          onLogout={onLogout}
          onDashboard={() => setPage('dashboard')}
        />

        <ChatPanel
          selectedModuleId={selectedModuleId}
          userType="teacher"
          studentData={null}
        />
      </div>
    </div>
  )
}

/* ── StudentApp ──────────────────────────────────────────────── */
function StudentApp({ studentData, onLogout }) {
  // One-time init: load or create first session
  const initRef = useRef(null)
  if (!initRef.current) {
    const stored = loadStudentSessions(studentData.courseCode)
    if (stored.length > 0) {
      initRef.current = { sessions: stored, activeId: stored[0].id }
    } else {
      const first = makeNewSession()
      saveStudentSessions(studentData.courseCode, [first])
      initRef.current = { sessions: [first], activeId: first.id }
    }
  }

  const [sessions, setSessions] = useState(initRef.current.sessions)
  const [activeSessionId, setActiveSessionId] = useState(initRef.current.activeId)
  const teacherName = studentData.teacherName ?? null

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  const handleNewSession = () => {
    const session = makeNewSession()
    const updated = [session, ...sessions]
    setSessions(updated)
    saveStudentSessions(studentData.courseCode, updated)
    setActiveSessionId(session.id)
  }

  const handleSessionUpdate = (msgs, backendSid) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== activeSessionId) return s
        const firstUserMsg = msgs.find((m) => m.role === 'student')
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '…' : '')
          : s.title
        return { ...s, messages: msgs, backendSessionId: backendSid ?? s.backendSessionId, title }
      })
      saveStudentSessions(studentData.courseCode, updated)
      return updated
    })
  }

  const handleRenameSession = (sessionId, newTitle) => {
    setSessions((prev) => {
      const updated = prev.map((s) => s.id === sessionId ? { ...s, title: newTitle } : s)
      saveStudentSessions(studentData.courseCode, updated)
      return updated
    })
  }

  const handleDeleteSession = (sessionId) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
      // If we just deleted the active session, switch to the next one or create a fresh one
      if (activeSessionId === sessionId) {
        const next = updated[0] ?? null
        if (next) {
          setActiveSessionId(next.id)
        } else {
          const fresh = makeNewSession()
          updated.push(fresh)
          setActiveSessionId(fresh.id)
        }
      }
      saveStudentSessions(studentData.courseCode, updated)
      return updated
    })
  }

  return (
    <div className="flex flex-row h-screen bg-gray-50">
      <StudentSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        courseCode={studentData.courseCode}
        moduleName={studentData.moduleName}
        teacherName={teacherName}
        onLogout={onLogout}
      />
      <div className="flex flex-col flex-1 min-w-0 bg-white">
        {/* Top bar with Leave button */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-red-500 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            Leave
          </button>
        </div>
        {activeSession && (
          <ChatPanel
            selectedModuleId={studentData.moduleId}
            userType="student"
            studentData={studentData}
            sessionKey={activeSessionId}
            initialMessages={activeSession.messages}
            onMessagesUpdate={handleSessionUpdate}
          />
        )}
      </div>
    </div>
  )
}

/* ── GuestApp ────────────────────────────────────────────────── */
function GuestApp({ onLeave }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-600 text-xs font-bold tracking-wider">TP</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Teacher's Pet</h1>
              <p className="text-xs text-gray-400">AI-Powered Math Tutor</p>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
        </div>
      </header>
      <ChatPanel selectedModuleId={null} userType="guest" studentData={null} />
    </div>
  )
}

/* ── StudentSidebar ──────────────────────────────────────────── */
function StudentSidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onRenameSession, onDeleteSession, courseCode, moduleName, teacherName, onLogout }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const editInputRef = useRef(null)

  const startRename = (session, e) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditValue(session.title)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  const commitRename = () => {
    if (editValue.trim()) onRenameSession(editingId, editValue.trim())
    setEditingId(null)
  }

  const confirmDelete = (e, sessionId) => {
    e.stopPropagation()
    setConfirmDeleteId(sessionId)
  }

  return (
    <aside className="relative w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      {/* New Session button */}
      <div className="px-3 pt-4 pb-3 border-b border-gray-100">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </button>
      </div>

      {/* Session history */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Recent Learning
        </p>
        <div className="flex flex-col gap-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={[
                'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                activeSessionId === session.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
              onClick={() => editingId !== session.id && onSelectSession(session.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {editingId === session.id ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              ) : (
                <>
                  <span className="truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => startRename(session, e)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-indigo-500 transition-opacity"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => confirmDelete(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-red-500 transition-opacity"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 rounded-r-none" style={{ borderRadius: 0 }}>
          <div className="bg-white rounded-xl shadow-lg mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Delete this session?</p>
              <p className="text-xs text-gray-500 mt-1">This will permanently remove the chat history and cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg border border-gray-200 text-gray-600 text-sm py-1.5 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteSession(confirmDeleteId); setConfirmDeleteId(null) }}
                className="flex-1 rounded-lg bg-red-500 text-white text-sm py-1.5 font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: course info + leave */}
      <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-2">
        {moduleName && (
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="truncate font-medium">{moduleName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded tracking-widest border border-indigo-100">
            {courseCode}
          </span>
          {teacherName && (
            <span className="text-xs text-gray-400 truncate">by {teacherName}</span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full rounded-md border border-gray-200 text-gray-500 text-xs py-1.5 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
        >
          Leave Session
        </button>
      </div>
    </aside>
  )
}

/* ── StudentEmptyState ───────────────────────────────────────── */
function StudentEmptyState({ greeting, onQuickAction }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 select-none">
      {/* Logo icon */}
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
          <ellipse cx="5.5" cy="6.5" rx="2.5" ry="3" />
          <ellipse cx="10" cy="4" rx="2" ry="2.5" />
          <ellipse cx="14.5" cy="4" rx="2" ry="2.5" />
          <ellipse cx="18.5" cy="6.5" rx="2" ry="2.5" />
          <path d="M12 9c-4.418 0-8 2.686-8 6 0 2.21 3.582 4 8 4s8-1.79 8-4c0-3.314-3.582-6-8-6z" />
        </svg>
      </div>

      {/* Greeting */}
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">{greeting}</h2>
      <p className="text-gray-500 text-sm text-center mb-8 max-w-sm">
        I can help you with homework, explain tough concepts, or just practice.
      </p>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-2xl">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.title}
            onClick={() => onQuickAction(action.response)}
            className="flex flex-col gap-2.5 p-4 bg-white border border-gray-200 rounded-xl text-left hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className={`w-8 h-8 rounded-lg ${action.iconBg} ${action.iconColor} flex items-center justify-center`}>
              {action.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{action.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{action.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── ChatPanel (shared) ──────────────────────────────────────── */
function ChatPanel({ selectedModuleId, userType, studentData, sessionKey, initialMessages, onMessagesUpdate }) {
  const [messages, setMessages] = useState(initialMessages ?? [WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [greeting] = useState(
    () => GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)]
  )
  const scrollRef = useRef(null)

  // Keep a ref to initialMessages so the reset effect doesn't need it as a dep
  const initialMessagesRef = useRef(initialMessages)
  useEffect(() => { initialMessagesRef.current = initialMessages }, [initialMessages])

  // Reset when switching sessions (student multi-session)
  useEffect(() => {
    if (sessionKey !== undefined) {
      setMessages(initialMessagesRef.current ?? [WELCOME_MESSAGE])
      setSessionId(null)
      setInput('')
    }
  }, [sessionKey])

  // Reset when module changes (teacher / guest mode only)
  useEffect(() => {
    if (sessionKey === undefined) {
      setMessages([WELCOME_MESSAGE])
      setSessionId(null)
    }
  }, [selectedModuleId])

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

      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setSessionId(data.session_id)
      const finalMessages = [...withQuestion, { role: 'tutor', content: data.answer, isError: data.error }]
      setMessages(finalMessages)
      if (onMessagesUpdate) onMessagesUpdate(finalMessages, data.session_id)

      // Log to Firestore for students only
      if (userType === 'student' && studentData && !data.error) {
        addDoc(collection(db, 'prompts'), {
          courseCode: studentData.courseCode ?? null,
          moduleId: selectedModuleId ?? null,
          moduleName: studentData.moduleName ?? null,
          teacherUid: studentData.teacherUid ?? null,
          sessionId: data.session_id,
          prompt: question,
          response: data.answer,
          timestamp: serverTimestamp(),
        }).catch(() => { /* swallow — logging must never block UI */ })
      }
    } catch {
      const errMessages = [
        ...withQuestion,
        {
          role: 'tutor',
          content: "I couldn't reach the server. Make sure the backend is running on port 8000 and try again.",
          isError: true,
        },
      ]
      setMessages(errMessages)
      if (onMessagesUpdate) onMessagesUpdate(errMessages, sessionId)
    } finally {
      setLoading(false)
    }
  }

  // Quick action: replace welcome message with predetermined tutor response (no API call)
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
      <section className="flex-1 overflow-y-auto px-4 py-6">
        {isStudentEmptyState ? (
          <StudentEmptyState greeting={greeting} onQuickAction={handleQuickAction} />
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
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
        <p className="text-center text-xs text-gray-400 pb-2 px-4">
          All messages and responses are sent directly to course staff for review.
        </p>
      )}
    </>
  )
}

/* ── TeacherSidebar ──────────────────────────────────────────── */
function TeacherSidebar({
  open, onToggle, modules, selectedModuleId, onSelect,
  onModuleCreated, documents, onDocumentsChanged, currentUser, onModulesChanged,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [courseCodes, setCourseCodes] = useState({}) // moduleId → code
  const [generatingFor, setGeneratingFor] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  // Load existing course codes for this teacher's modules from Firestore
  useEffect(() => {
    if (!currentUser || modules.length === 0) return
    const fetchCodes = async () => {
      const { collection, query, where, getDocs } = await import('firebase/firestore')
      const q = query(
        collection(db, 'courseCodes'),
        where('teacherUid', '==', currentUser.uid),
      )
      const snap = await getDocs(q)
      const map = {}
      snap.docs.forEach((d) => { map[d.data().moduleId] = d.id })
      setCourseCodes(map)
    }
    fetchCodes().catch(() => {})
  }, [currentUser, modules])

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || creating) return

    setCreating(true)
    try {
      const body = { name, description: newDesc.trim() || undefined }
      if (currentUser) body.teacher_uid = currentUser.uid

      const res = await fetch('http://localhost:8000/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const created = await res.json()
      await onModuleCreated()
      onSelect(created.id)
      setNewName('')
      setNewDesc('')
      setShowCreateForm(false)
    } catch { /* ignore */ } finally {
      setCreating(false)
    }
  }

  const handleGenerateCode = async (mod) => {
    setGeneratingFor(mod.id)
    try {
      const code = await getUniqueCode()
      await setDoc(doc(db, 'courseCodes', code), {
        moduleId: mod.id,
        moduleName: mod.name,
        teacherUid: currentUser?.uid ?? null,
        teacherName: currentUser?.displayName || currentUser?.email || null,
        createdAt: serverTimestamp(),
      })
      setCourseCodes((prev) => ({ ...prev, [mod.id]: code }))
    } catch (err) {
      alert('Failed to generate code: ' + err.message)
    } finally {
      setGeneratingFor(null)
    }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  if (!open) {
    return (
      <div className="flex flex-col items-center border-r border-gray-200 bg-white py-4 px-1">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
          title="Open sidebar"
        >
          &#9776;
        </button>
      </div>
    )
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Modules</span>
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors text-xs"
          title="Close sidebar"
        >
          &#10005;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        <button
          onClick={() => onSelect(null)}
          className={[
            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            selectedModuleId === null
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100',
          ].join(' ')}
        >
          No module (general chat)
        </button>

        {modules.map((mod) => (
          <div key={mod.id} className="flex flex-col gap-0.5">
            <button
              onClick={() => onSelect(mod.id)}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedModuleId === mod.id
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <span className="block truncate">{mod.name}</span>
              {mod.description && (
                <span className="block text-xs text-gray-400 truncate">{mod.description}</span>
              )}
            </button>

            {/* course code area */}
            <div className="px-3 pb-1">
              {courseCodes[mod.id] ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 tracking-widest">
                    {courseCodes[mod.id]}
                  </span>
                  <button
                    onClick={() => copyCode(courseCodes[mod.id])}
                    className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === courseCodes[mod.id] ? '✓' : '⧉'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleGenerateCode(mod)}
                  disabled={generatingFor === mod.id}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium disabled:opacity-40 transition-colors"
                >
                  {generatingFor === mod.id ? 'Generating…' : '+ Generate Code'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedModuleId && (
        <DocumentPanel
          moduleId={selectedModuleId}
          documents={documents}
          onDocumentsChanged={onDocumentsChanged}
        />
      )}

      <div className="border-t border-gray-100 px-3 py-3">
        {showCreateForm ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Module name"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="flex-1 rounded-md bg-indigo-600 text-white text-sm py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-gray-300 text-gray-600 text-sm px-3 py-1.5 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full rounded-md border border-dashed border-indigo-200 text-indigo-600 text-sm py-2 font-medium hover:bg-indigo-50 transition-colors"
          >
            + Create Module
          </button>
        )}
      </div>
    </aside>
  )
}

/* ── DocumentPanel ───────────────────────────────────────────── */
function DocumentPanel({ moduleId, documents, onDocumentsChanged }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await fetch(
        `http://localhost:8000/modules/${moduleId}/documents`,
        { method: 'POST', body: form },
      )
      const docData = await uploadRes.json()
      await fetch(
        `http://localhost:8000/modules/${moduleId}/documents/${docData.id}/process`,
        { method: 'POST' },
      )
    } catch { /* handled via status */ } finally {
      setUploading(false)
      onDocumentsChanged()
    }
  }

  const handleDelete = async (docId) => {
    try {
      await fetch(`http://localhost:8000/modules/${moduleId}/documents/${docId}`, { method: 'DELETE' })
    } catch { /* ignore */ }
    onDocumentsChanged()
  }

  const statusBadge = (doc) => {
    const base = 'inline-block text-xs px-1.5 py-0.5 rounded-full font-medium'
    switch (doc.status) {
      case 'processing':
        return <span className={`${base} bg-amber-100 text-amber-700 animate-pulse`}>processing</span>
      case 'processed':
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            processed{doc.chunk_count != null ? ` (${doc.chunk_count})` : ''}
          </span>
        )
      case 'error':
        return (
          <span className={`${base} bg-red-100 text-red-600`} title={doc.error_message || 'Processing error'}>
            error
          </span>
        )
      default:
        return <span className={`${base} bg-gray-100 text-gray-500`}>uploaded</span>
    }
  }

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-40"
        >
          {uploading ? 'Uploading...' : '+ Upload'}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={handleUpload} className="hidden" />
      </div>

      {documents.length === 0 && !uploading && (
        <p className="text-xs text-gray-400 py-1">No documents yet.</p>
      )}

      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-gray-700" title={doc.filename}>{doc.original_filename}</span>
              {statusBadge(doc)}
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="flex-shrink-0 w-5 h-5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              title="Delete document"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {uploading && (
        <div className="flex items-center gap-1.5 py-1 text-xs text-amber-600">
          <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Uploading & processing...
        </div>
      )}
    </div>
  )
}

/* ── TeacherHeader ───────────────────────────────────────────── */
function TeacherHeader({ selectedModule, currentUser, onLogout, onDashboard }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 text-xs font-bold tracking-wider">TP</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Teacher's Pet</h1>
            <p className="text-xs text-gray-400">
              {selectedModule ? selectedModule.name : 'No module selected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDashboard}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {currentUser?.displayName ? `Logout (${currentUser.displayName.split(' ')[0]})` : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  )
}

/* ── StudentHeader ───────────────────────────────────────────── */
function StudentHeader({ moduleName, courseCode, onLogout }) {
  return (
    <header className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold tracking-wider">TP</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Teacher's Pet</h1>
            <p className="text-blue-100 text-sm">{moduleName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs bg-white/20 border border-white/30 px-2 py-1 rounded tracking-widest">
            {courseCode}
          </span>
          <button
            onClick={onLogout}
            className="rounded-lg bg-white/20 border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/30 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </header>
  )
}

/* ── Bubble ──────────────────────────────────────────────────── */
function Bubble({ message }) {
  const isStudent = message.role === 'student'

  return (
    <div className={`flex items-end gap-2 ${isStudent ? 'flex-row-reverse' : ''}`}>
      {!isStudent && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
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
    </div>
  )
}

/* ── TypingIndicator ─────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">TP</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-3">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

/* ── InputBar ────────────────────────────────────────────────── */
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
          className="flex-1 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-indigo-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

/* ── LoadingSpinner ──────────────────────────────────────────── */
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}

/* ── TeacherDashboard ────────────────────────────────────────── */
function TeacherDashboard({ onBack, onLogout, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'analytics'

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-600 text-xs font-bold tracking-wider">TP</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Teacher Dashboard</h1>
              <p className="text-xs text-gray-400">
                {currentUser?.displayName || currentUser?.email || "Teacher's Pet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back to Chat
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome back{currentUser?.displayName ? `, ${currentUser.displayName.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-gray-500 mt-1">Here's an overview of your classroom.</p>
          </div>

          {/* tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'overview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={[
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'analytics' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              Analytics
            </button>
          </div>

          {activeTab === 'analytics' ? (
            <AnalyticsDashboard />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <DashboardStat label="Active Students" value="--" color="blue" />
                <DashboardStat label="Modules" value="--" color="purple" />
                <DashboardStat label="Documents" value="--" color="amber" />
                <DashboardStat label="Chat Sessions" value="--" color="green" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DashboardCard
                  title="Student Performance"
                  description="View student progress, session history, and identify areas where students need extra help."
                  icon={<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />}
                  tag="Analytics"
                  tagColor="blue"
                  onClick={() => setActiveTab('analytics')}
                />
                <DashboardCard
                  title="Manage Modules"
                  description="Create, edit, and organize teaching modules. Assign grade levels and topics for targeted tutoring."
                  icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                  tag="Content"
                  tagColor="purple"
                  onClick={onBack}
                />
                <DashboardCard
                  title="Upload Textbooks"
                  description="Upload PDF or text files to modules. Documents are chunked and embedded for AI-powered tutoring."
                  icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>}
                  tag="Upload"
                  tagColor="amber"
                  onClick={onBack}
                />
                <DashboardCard
                  title="Manage Classes"
                  description="Organize students into classes, assign modules, and track class-wide performance metrics."
                  icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
                  tag="Classes"
                  tagColor="green"
                />
                <DashboardCard
                  title="Review Chat Logs"
                  description="Browse student chat sessions to understand common questions and improve module content."
                  icon={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>}
                  tag="Sessions"
                  tagColor="indigo"
                  onClick={() => setActiveTab('analytics')}
                />
                <DashboardCard
                  title="Settings"
                  description="Configure AI behavior, safety filters, system prompts, and manage teacher account credentials."
                  icon={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
                  tag="Admin"
                  tagColor="gray"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── DashboardStat ───────────────────────────────────────────── */
function DashboardStat({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </div>
  )
}

/* ── DashboardCard ───────────────────────────────────────────── */
function DashboardCard({ title, description, icon, tag, tagColor, onClick }) {
  const tagColors = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <div
      onClick={onClick}
      className={[
        'bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3 group',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColors[tagColor]}`}>{tag}</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      <span className="text-xs text-indigo-600 font-medium mt-auto group-hover:underline">
        {onClick ? 'Open →' : 'Coming soon →'}
      </span>
    </div>
  )
}
