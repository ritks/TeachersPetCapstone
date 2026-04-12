import { useState, useRef, useEffect } from 'react'
import { APP_COPY } from './content/strings'
import { useAuth } from './contexts/AuthContext'
import EntryPage from './components/EntryPage'
import ChatPanel, { WELCOME_MESSAGE } from './components/chat/ChatPanel'
import LoadingSpinner from './components/common/LoadingSpinner'
import StudentSidebar from './components/student/StudentSidebar'
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
  return <TeacherDashboard onLogout={onLogout} currentUser={currentUser} />
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
