import { useState, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { APP_COPY } from './content/strings'
import { useAuth } from './contexts/AuthContext'
import { useStudent } from './contexts/StudentContext'
import EntryPage from './components/EntryPage'
import ChatPanel, { WELCOME_MESSAGE } from './components/chat/ChatPanel'
import LoadingSpinner from './components/common/LoadingSpinner'
import StudentSidebar from './components/student/StudentSidebar'
import StudentDashboard from './components/student/StudentDashboard'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import { Button } from './components/ui/primitives'

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

function TeacherRoute({ currentUser, currentUserRole, authLoading, children }) {
  if (authLoading) return <LoadingSpinner />
  if (currentUser && currentUserRole === 'teacher') return children
  return <Navigate to="/" replace />
}

function StudentRoute({ currentUser, currentUserRole, studentData, authLoading, children }) {
  if (authLoading) return <LoadingSpinner />
  // Allow authenticated students OR guest users with a course code
  if ((currentUser && currentUserRole === 'student') || (!currentUser && studentData)) return children
  return <Navigate to="/" replace />
}


export default function App() {
  const { currentUser, currentUserRole, authLoading, logout } = useAuth()
  const { studentData, clearStudent } = useStudent()
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (currentUser) {
      await logout()
    } else {
      clearStudent()
    }
    navigate('/', { replace: true })
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          authLoading ? <LoadingSpinner /> :
          currentUser && currentUserRole === 'teacher' ? <Navigate to="/teacher" replace /> :
          (currentUser && currentUserRole === 'student') || studentData ? <Navigate to="/student" replace /> :
          <EntryPage />
        }
      />
      <Route
        path="/teacher"
        element={
          <TeacherRoute currentUser={currentUser} currentUserRole={currentUserRole} authLoading={authLoading}>
            <TeacherApp currentUser={currentUser} onLogout={handleLogout} />
          </TeacherRoute>
        }
      />
      <Route
        path="/student"
        element={
          <StudentRoute currentUser={currentUser} currentUserRole={currentUserRole} studentData={studentData} authLoading={authLoading}>
            {currentUser
              ? <StudentDashboard currentUser={currentUser} onLogout={handleLogout} />
              : <StudentApp studentData={studentData} onLogout={handleLogout} />
            }
          </StudentRoute>
        }
      />
      <Route
        path="/student/module/:moduleId"
        element={
          <StudentRoute currentUser={currentUser} currentUserRole={currentUserRole} studentData={studentData} authLoading={authLoading}>
            <StudentModuleView onLogout={handleLogout} />
          </StudentRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function TeacherApp({ currentUser, onLogout }) {
  return <TeacherDashboard onLogout={onLogout} currentUser={currentUser} />
}

function StudentModuleView({ onLogout }) {
  const { moduleId } = useParams()
  const { getModule } = useStudent()
  const navigate = useNavigate()
  const moduleData = getModule(moduleId)

  if (!moduleData) {
    // Module not in registry (e.g. direct URL visit without going through dashboard)
    return <Navigate to="/student" replace />
  }

  return (
    <StudentApp
      studentData={moduleData}
      onLogout={onLogout}
      onBack={() => navigate('/student')}
    />
  )
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
