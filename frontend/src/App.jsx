import { useState, useRef, useEffect } from 'react'
import { APP_COPY } from './content/strings'
import { useAuth } from './contexts/AuthContext'
import EntryPage from './components/EntryPage'
import ChatPanel, { WELCOME_MESSAGE } from './components/chat/ChatPanel'
import LoadingSpinner from './components/common/LoadingSpinner'
import StudentSidebar from './components/student/StudentSidebar'
import StudentDashboard from './components/student/StudentDashboard'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import { Button } from './components/ui/primitives'

const NAV_STATE_KEY = 'tpNav'
const NAV_STUDENT_MODE_KEY = 'tpStudentMode'
const NAV_STUDENT_MODULE_KEY = 'tpStudentModule'

const APP_VIEWS = {
  ENTRY: 'entry',
  TEACHER: 'teacher',
  STUDENT: 'student',
}

function getAppView({ userType, currentUser, studentData, authLoading }) {
  if (authLoading) return null
  if (userType === null) return APP_VIEWS.ENTRY
  if (userType === 'teacher' && !currentUser) return APP_VIEWS.ENTRY
  if (userType === 'student' && !currentUser && !studentData) return APP_VIEWS.ENTRY
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
  const { currentUser, currentUserRole, authLoading, logout } = useAuth()

  const [userType, setUserType] = useState(null)
  const [studentData, setStudentData] = useState(null)
  const [selectedStudentModule, setSelectedStudentModule] = useState(null)
  const didInitRef = useRef(false)
  const handlingPopRef = useRef(false)
  const lastNavRef = useRef(null)

  useEffect(() => {
    if (authLoading || didInitRef.current) return
    didInitRef.current = true

    if (currentUser) {
      setUserType(currentUserRole === 'student' ? 'student' : 'teacher')
      return
    }

    const data = loadStoredStudent()
    if (data) {
      setStudentData(data)
      setUserType('student')
    }
  }, [authLoading, currentUser, currentUserRole])

  useEffect(() => {
    if (!currentUser) return
    if (currentUserRole === 'student') {
      setSelectedStudentModule(null)
      setStudentData(null)
    }
  }, [currentUser, currentUserRole])

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
          setSelectedStudentModule(null)
          break
        case APP_VIEWS.TEACHER:
          setUserType('teacher')
          setSelectedStudentModule(null)
          break
        case APP_VIEWS.STUDENT: {
          setUserType('student')
          const studentMode = event.state?.[NAV_STUDENT_MODE_KEY] || 'dashboard'
          const studentModule = event.state?.[NAV_STUDENT_MODULE_KEY] || null
          const hasExplicitStudentNav = Object.prototype.hasOwnProperty.call(event.state || {}, NAV_STUDENT_MODE_KEY)
          if (hasExplicitStudentNav) {
            setSelectedStudentModule(studentMode === 'module' ? studentModule : null)
          } else {
            // Legacy guest-student flow (course-code session without auth).
            const data = loadStoredStudent()
            setStudentData(data)
            setSelectedStudentModule(null)
          }
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

    const isStudentNav = appView === APP_VIEWS.STUDENT && !!currentUser
    const studentMode = isStudentNav ? (selectedStudentModule ? 'module' : 'dashboard') : null
    const state = { ...(window.history.state || {}), [NAV_STATE_KEY]: appView }
    if (isStudentNav) {
      state[NAV_STUDENT_MODE_KEY] = studentMode
      state[NAV_STUDENT_MODULE_KEY] = selectedStudentModule || null
    }
    const navToken = isStudentNav ? `${appView}:${studentMode}` : appView

    if (lastNavRef.current === null) {
      window.history.replaceState(state, '', window.location.href)
      lastNavRef.current = navToken
      return
    }

    if (handlingPopRef.current) {
      handlingPopRef.current = false
      lastNavRef.current = navToken
      return
    }

    if (navToken !== lastNavRef.current) {
      window.history.pushState(state, '', window.location.href)
      lastNavRef.current = navToken
    } else if (isStudentNav && studentMode === 'module') {
      // Keep module payload in sync without stacking history entries.
      window.history.replaceState(state, '', window.location.href)
    }
  }, [appView, currentUser, selectedStudentModule])

  if (authLoading) return <LoadingSpinner />

  if (userType === null) {
    return (
      <EntryPage
        onStudentEntry={() => {}}
        onTeacherEntry={() => {}}
        onStudentAuthSuccess={() => {
          setUserType('student')
        }}
        onTeacherAuthSuccess={() => setUserType('teacher')}
      />
    )
  }

  const handleLogout = async () => {
    if (currentUser) {
      await logout()
    } else {
      localStorage.removeItem('tp_student')
      setStudentData(null)
    }
    setSelectedStudentModule(null)
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

  if (currentUser) {
    if (selectedStudentModule) {
      return (
        <StudentApp
          studentData={selectedStudentModule}
          onLogout={handleLogout}
          onBack={() => setSelectedStudentModule(null)}
        />
      )
    }
    return (
      <StudentDashboard
        currentUser={currentUser}
        onOpenModule={(module) => setSelectedStudentModule(module)}
        onLogout={handleLogout}
      />
    )
  }

  return <StudentApp studentData={studentData} onLogout={handleLogout} />
}

function TeacherApp({ currentUser, onLogout }) {
  return <TeacherDashboard onLogout={onLogout} currentUser={currentUser} />
}

function StudentApp({ studentData, onLogout, onBack = null }) {
  const storageKey = studentData.courseCode || `${studentData.classId || 'class'}_${studentData.moduleId}`
  const initRef = useRef(null)
  if (!initRef.current) {
    const stored = loadStudentSessions(storageKey)
    if (stored.length > 0) {
      initRef.current = { sessions: stored, activeId: stored[0].id }
    } else {
      const first = makeNewSession()
      saveStudentSessions(storageKey, [first])
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
    saveStudentSessions(storageKey, updated)
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
      saveStudentSessions(storageKey, updated)
      return updated
    })
  }

  const handleRenameSession = (sessionId, newTitle) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      saveStudentSessions(storageKey, updated)
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
      saveStudentSessions(storageKey, updated)
      return updated
    })
  }

  return (
    <div className="flex flex-row h-screen bg-[linear-gradient(145deg,rgba(248,249,250,0.96),rgba(227,236,247,0.82))]">
      <StudentSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        courseCode={studentData.courseCode || 'ENROLLED'}
        moduleName={studentData.moduleName}
        teacherName={teacherName}
        onLogout={onLogout}
      />
      <div className="flex flex-col flex-1 min-w-0 bg-transparent">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(65,90,119,0.18)] bg-[rgba(248,249,250,0.82)] backdrop-blur-sm flex-shrink-0">
          <div>
            {onBack && (
              <Button onClick={onBack} variant="secondary" size="sm">
                Back to Dashboard
              </Button>
            )}
          </div>
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
