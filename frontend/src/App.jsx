import { useState, useRef, useEffect } from 'react'
import {
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { APP_COPY } from './content/strings'
import { useAuth } from './contexts/AuthContext'
import EntryPage from './components/EntryPage'
import ChatPanel, { WELCOME_MESSAGE } from './components/chat/ChatPanel'
import LoadingSpinner from './components/common/LoadingSpinner'
import StudentSidebar from './components/student/StudentSidebar'
import TeacherHeader from './components/teacher/TeacherHeader'
import TeacherSidebar from './components/teacher/TeacherSidebar'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import { Button } from './components/ui/primitives'

const NAV_STATE_KEY = 'tpNav'

const APP_VIEWS = {
  ENTRY: 'entry',
  TEACHER: 'teacher',
  STUDENT: 'student',
}

function getAppView({ userType, currentUser, studentData, authLoading }) {
  if (authLoading) return null
  if (userType === null) return APP_VIEWS.ENTRY
  if (userType === 'teacher' && !currentUser) return APP_VIEWS.ENTRY
  if (userType === 'student' && !studentData) return APP_VIEWS.ENTRY
  if (userType === 'teacher') return APP_VIEWS.TEACHER
  return APP_VIEWS.STUDENT
}

function loadStoredStudent() {
  const raw = localStorage.getItem('tp_student')
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.courseCode && data?.moduleId) return data
  } catch {
    /* ignore */
  }
  return null
}

function loadStudentSessions(courseCode) {
  try {
    const raw = localStorage.getItem(`tp_sessions_${courseCode}`)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return []
}

function saveStudentSessions(courseCode, sessions) {
  try {
    localStorage.setItem(`tp_sessions_${courseCode}`, JSON.stringify(sessions))
  } catch {
    /* ignore */
  }
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

export default function App() {
  const { currentUser, authLoading, logout } = useAuth()

  const [userType, setUserType] = useState(null)
  const [studentData, setStudentData] = useState(null)
  const didInitRef = useRef(false)
  const handlingPopRef = useRef(false)
  const lastViewRef = useRef(null)

  useEffect(() => {
    if (authLoading || didInitRef.current) return
    didInitRef.current = true

    const data = loadStoredStudent()
    if (data) {
      setStudentData(data)
      setUserType('student')
      return
    }
    if (currentUser) {
      setUserType('teacher')
    }
  }, [authLoading, currentUser])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const onPopState = (event) => {
      const view = event.state?.[NAV_STATE_KEY]
      if (!view) return
      if (!Object.values(APP_VIEWS).includes(view)) return

      handlingPopRef.current = true
      switch (view) {
        case APP_VIEWS.ENTRY:
          setUserType(null)
          break
        case APP_VIEWS.TEACHER:
          setUserType('teacher')
          break
        case APP_VIEWS.STUDENT: {
          const data = loadStoredStudent()
          setStudentData(data)
          setUserType('student')
          break
        }
        default:
          break
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const appView = getAppView({ userType, currentUser, studentData, authLoading })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (appView === null || !didInitRef.current) return

    const state = { ...(window.history.state || {}), [NAV_STATE_KEY]: appView }

    if (lastViewRef.current === null) {
      window.history.replaceState(state, '', window.location.href)
      lastViewRef.current = appView
      return
    }

    if (handlingPopRef.current) {
      handlingPopRef.current = false
      lastViewRef.current = appView
      return
    }

    if (appView !== lastViewRef.current) {
      window.history.pushState(state, '', window.location.href)
      lastViewRef.current = appView
    }
  }, [appView])

  if (authLoading) return <LoadingSpinner />

  if (userType === null) {
    return (
      <EntryPage
        onStudentEntry={() => {}}
        onTeacherEntry={() => {}}
        onStudentAuthSuccess={(data) => {
          setStudentData(data)
          setUserType('student')
        }}
        onTeacherAuthSuccess={() => setUserType('teacher')}
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

  return (
    <StudentApp
      studentData={studentData}
      onLogout={handleLogout}
    />
  )
}

function TeacherApp({ currentUser, onLogout }) {
  const [page, setPage] = useState('chat')
  const [modules, setModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documents, setDocuments] = useState([])
  const handlingPagePopRef = useRef(false)
  const lastPageRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const stateView = window.history.state?.[NAV_STATE_KEY]
    if (stateView === 'teacher-dashboard') {
      setPage('dashboard')
      lastPageRef.current = 'dashboard'
    } else {
      setPage('chat')
      window.history.replaceState(
        { ...(window.history.state || {}), [NAV_STATE_KEY]: 'teacher-chat' },
        '',
        window.location.href,
      )
      lastPageRef.current = 'chat'
    }

    const onPopState = (event) => {
      const view = event.state?.[NAV_STATE_KEY]
      if (view !== 'teacher-chat' && view !== 'teacher-dashboard') return
      handlingPagePopRef.current = true
      setPage(view === 'teacher-dashboard' ? 'dashboard' : 'chat')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (lastPageRef.current === null) return

    if (handlingPagePopRef.current) {
      handlingPagePopRef.current = false
      lastPageRef.current = page
      return
    }

    if (page === lastPageRef.current) return

    window.history.pushState(
      {
        ...(window.history.state || {}),
        [NAV_STATE_KEY]: page === 'dashboard' ? 'teacher-dashboard' : 'teacher-chat',
      },
      '',
      window.location.href,
    )
    lastPageRef.current = page
  }, [page])

  const refreshDocuments = async (moduleId) => {
    const id = moduleId ?? selectedModuleId
    if (!id) {
      setDocuments([])
      return
    }
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
    } catch {
      /* ignore */
    }
  }

  useEffect(() => { refreshModules() }, [currentUser])
  useEffect(() => { refreshDocuments() }, [selectedModuleId])

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
        createUniqueCode={getUniqueCode}
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

function StudentApp({ studentData, onLogout }) {
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
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      saveStudentSessions(studentData.courseCode, updated)
      return updated
    })
  }

  const handleDeleteSession = (sessionId) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
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
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <Button
            onClick={onLogout}
            variant="ghost"
            size="md"
            className="text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            {APP_COPY.leave}
          </Button>
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
