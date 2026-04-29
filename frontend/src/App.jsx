import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { APP_COPY } from './content/strings'
import { useAuth } from './contexts/AuthContext'
import { useStudent } from './contexts/StudentContext'
import { ThemeProvider } from './contexts/ThemeContext'
import EntryPage from './components/EntryPage'
import ChatPanel, { WELCOME_MESSAGE } from './components/chat/ChatPanel'
import LoadingSpinner from './components/common/LoadingSpinner'
import StudentSidebar from './components/student/StudentSidebar'
import StudentDashboard from './components/student/StudentDashboard'
import PdfViewerPanel from './components/student/PdfViewerPanel'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import { Button } from './components/ui/primitives'
import { apiUrl } from './lib/api'
import ThemeToggleButton from './components/common/ThemeToggleButton'

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
  // Guest users with stored student data don't need Firebase auth to resolve
  if (authLoading && !studentData) return <LoadingSpinner />
  // Allow authenticated students OR guest users with a course code
  if ((currentUser && currentUserRole === 'student') || (!currentUser && studentData)) return children
  return <Navigate to="/" replace />
}


export default function App() {
  const { currentUser, currentUserRole, currentUserProfile, authLoading, logout } = useAuth()
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
    <ThemeProvider
      currentUser={currentUser}
      currentUserProfile={currentUserProfile}
      authLoading={authLoading}
      allowGuestTheme={Boolean(studentData)}
    >
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
              : <StudentApp studentData={studentData} onLogout={handleLogout} currentUser={null} />
            }
          </StudentRoute>
        }
      />
      <Route
        path="/student/module/:moduleId"
        element={
          <StudentRoute currentUser={currentUser} currentUserRole={currentUserRole} studentData={studentData} authLoading={authLoading}>
            <StudentModuleView onLogout={handleLogout} currentUser={currentUser} />
          </StudentRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ThemeProvider>
  )
}

function TeacherApp({ currentUser, onLogout }) {
  return <TeacherDashboard onLogout={onLogout} currentUser={currentUser} />
}

function StudentModuleView({ onLogout, currentUser }) {
  const { moduleId } = useParams()
  const { getModule, registerModule } = useStudent()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  let moduleData = getModule(moduleId)

  // Allow direct URL access by fetching module info from the backend
  if (!moduleData && !loading) {
    setLoading(true)
    fetch(apiUrl(`/modules/${moduleId}`))
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const fallback = {
            classId: 'direct-access',
            moduleId: data.id,
            moduleName: data.name,
            moduleDescription: data.description || null,
            teacherName: null,
            courseCode: 'DIRECT',
          }
          registerModule(data.id, fallback)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  if (loading) return <LoadingSpinner />

  if (!moduleData) {
    return <Navigate to="/student" replace />
  }

  return (
    <StudentApp
      studentData={moduleData}
      onLogout={onLogout}
      currentUser={currentUser}
      onBack={() => navigate('/student')}
    />
  )
}

function StudentApp({ studentData, onLogout, currentUser, onBack = null }) {
  const isAuthenticated = Boolean(currentUser)
  const storageKey = studentData.courseCode || `${studentData.classId || 'class'}_${studentData.moduleId}`
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [sessionsLoading, setSessionsLoading] = useState(isAuthenticated)
  const [activeCitations, setActiveCitations] = useState([])
  const [moduleDocuments, setModuleDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false)
  const teacherName = studentData.teacherName ?? null

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  const closeMobileSessions = () => setMobileSessionsOpen(false)

  const selectSession = (id) => {
    setActiveSessionId(id)
    setActiveCitations([])
    setPdfViewerOpen(false)
    closeMobileSessions()
  }

  useEffect(() => {
    if (isAuthenticated) return
    const stored = loadStudentSessions(storageKey)
    if (stored.length > 0) {
      setSessions(stored)
      setActiveSessionId(stored[0]?.id ?? '')
      return
    }
    const first = makeNewSession()
    saveStudentSessions(storageKey, [first])
    setSessions([first])
    setActiveSessionId(first.id)
  }, [isAuthenticated, storageKey])

  useEffect(() => {
    if (!studentData.moduleId) return
    let cancelled = false

    const loadModuleDocuments = async () => {
      setDocumentsLoading(true)
      try {
        const res = await fetch(apiUrl(`/modules/${studentData.moduleId}/documents`))
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || 'Failed to load documents')
        if (!cancelled) setModuleDocuments(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setModuleDocuments([])
      } finally {
        if (!cancelled) setDocumentsLoading(false)
      }
    }

    loadModuleDocuments()
    return () => { cancelled = true }
  }, [studentData.moduleId])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    const loadRemoteSessions = async () => {
      setSessionsLoading(true)
      try {
        const idToken = await currentUser.getIdToken()
        const res = await fetch(
          apiUrl(`/sessions?module_id=${encodeURIComponent(studentData.moduleId)}`),
          { headers: { Authorization: `Bearer ${idToken}` } },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || 'Failed to load chat sessions')
        const mapped = (Array.isArray(data) ? data : []).map((row) => ({
          id: row.session_id,
          title: row.title || 'New Chat',
          messages: [WELCOME_MESSAGE],
          backendSessionId: row.session_id,
          loadedFromServer: false,
          createdAt: Date.parse(row.created_at) || Date.now(),
        }))
        if (cancelled) return
        if (mapped.length === 0) {
          const fresh = makeNewSession()
          setSessions([fresh])
          setActiveSessionId(fresh.id)
        } else {
          setSessions(mapped)
          setActiveSessionId(mapped[0].id)
        }
      } catch {
        if (cancelled) return
        const fallback = makeNewSession()
        setSessions([fallback])
        setActiveSessionId(fallback.id)
      } finally {
        if (!cancelled) setSessionsLoading(false)
      }
    }

    loadRemoteSessions()
    return () => { cancelled = true }
  }, [currentUser, isAuthenticated, studentData.moduleId])

  useEffect(() => {
    if (!isAuthenticated) return
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session?.backendSessionId || session.loadedFromServer) return
    let cancelled = false

    const loadSessionDetail = async () => {
      try {
        const idToken = await currentUser.getIdToken()
        const res = await fetch(apiUrl(`/session/${session.backendSessionId}`), {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || 'Failed to load chat history')
        const history = Array.isArray(data.history) ? data.history : []
        const mappedHistory = history.map((m) => ({
          role: m.role === 'user' ? 'student' : 'tutor',
          content: m.content,
        }))
        if (cancelled) return
        setSessions((prev) => prev.map((row) => (
          row.id === session.id
            ? {
                ...row,
                title: data.title || row.title,
                messages: mappedHistory.length > 0 ? mappedHistory : [WELCOME_MESSAGE],
                loadedFromServer: true,
              }
            : row
        )))
      } catch {
        if (cancelled) return
        setSessions((prev) => prev.map((row) => (
          row.id === session.id
            ? { ...row, loadedFromServer: true }
            : row
        )))
      }
    }

    loadSessionDetail()
    return () => { cancelled = true }
  }, [activeSessionId, currentUser, isAuthenticated, sessions])

  const handleNewSession = () => {
    const session = makeNewSession()
    const updated = [session, ...sessions]
    setSessions(updated)
    if (!isAuthenticated) saveStudentSessions(storageKey, updated)
    setActiveSessionId(session.id)
    setActiveCitations([])
    setPdfViewerOpen(false)
    closeMobileSessions()
  }

  const handleSessionUpdate = (msgs, backendSid) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== activeSessionId) return s
        const firstUserMsg = msgs.find((m) => m.role === 'student')
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '…' : '')
          : s.title
        return {
          ...s,
          title,
          messages: msgs,
          backendSessionId: backendSid ?? s.backendSessionId,
          loadedFromServer: true,
        }
      })
      if (!isAuthenticated) saveStudentSessions(storageKey, updated)
      return updated
    })
  }

  const handleRenameSession = async (sessionId, newTitle) => {
    const target = sessions.find((s) => s.id === sessionId)
    if (isAuthenticated && target?.backendSessionId) {
      try {
        const idToken = await currentUser.getIdToken()
        await fetch(apiUrl(`/session/${target.backendSessionId}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ title: newTitle }),
        })
      } catch {
        /* ignore */
      }
    }
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      if (!isAuthenticated) saveStudentSessions(storageKey, updated)
      return updated
    })
  }

  const handleDeleteSession = async (sessionId) => {
    const target = sessions.find((s) => s.id === sessionId)
    if (isAuthenticated && target?.backendSessionId) {
      try {
        const idToken = await currentUser.getIdToken()
        await fetch(apiUrl(`/session/${target.backendSessionId}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        })
      } catch {
        /* ignore */
      }
    }
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
      if (!isAuthenticated) saveStudentSessions(storageKey, updated)
      return updated
    })
    if (sessionId === activeSessionId) {
      setActiveCitations([])
      setPdfViewerOpen(false)
      closeMobileSessions()
    }
  }

  const handleClearAllHistory = async () => {
    if (!isAuthenticated) return
    try {
      const idToken = await currentUser.getIdToken()
      await fetch(apiUrl('/sessions'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
    } catch {
      /* ignore */
    }
    const fresh = makeNewSession()
    setSessions([fresh])
    setActiveSessionId(fresh.id)
    setActiveCitations([])
    setPdfViewerOpen(false)
    closeMobileSessions()
  }

  const handleCitationsChange = (citations) => {
    setActiveCitations(citations)
    const hasPdf = citations.some((c) => c.original_filename?.toLowerCase().endsWith('.pdf'))
    if (hasPdf && !mobileSessionsOpen) setPdfViewerOpen(true)
  }

  return (
    <div
      className={`flex flex-col md:flex-row h-screen tp-card-surface-soft ${mobileSessionsOpen ? 'overflow-hidden' : 'overflow-y-auto'} md:overflow-hidden`}
    >
      <div className="hidden md:block">
        <StudentSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => selectSession(id)}
          onNewSession={handleNewSession}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          onClearAllHistory={isAuthenticated ? handleClearAllHistory : null}
          moduleName={studentData.moduleName}
          teacherName={teacherName}
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 bg-transparent">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)] backdrop-blur-sm flex-shrink-0">
          <div>
            <Button
              onClick={() => { setMobileSessionsOpen(true); setPdfViewerOpen(false) }}
              variant="ghost"
              size="icon"
              className="md:hidden w-8 h-8 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
              title="Sessions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </Button>
            {onBack && (
              <Button onClick={onBack} variant="secondary" size="sm">
                Back to Dashboard
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPdfViewerOpen((prev) => !prev)}
              variant="ghost"
              size="md"
              className={[
                'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]',
                pdfViewerOpen ? 'bg-[var(--color-bg-muted)] text-[var(--color-text-primary)]' : '',
              ].join(' ')}
              title={pdfViewerOpen ? 'Hide textbook' : 'Show textbook'}
            >
              Textbook
            </Button>
            <ThemeToggleButton />
            <Button
              onClick={onLogout}
              variant="ghost"
              size="md"
              className="text-gray-400 hover:text-red-500 hover:bg-red-50"
            >
              {APP_COPY.leave}
            </Button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className={`flex flex-col min-w-0 min-h-0 ${pdfViewerOpen ? 'md:flex-1' : 'flex-1'}`}>
            {sessionsLoading ? (
              <LoadingSpinner />
            ) : activeSession && (
              <ChatPanel
                selectedModuleId={studentData.moduleId}
                userType="student"
                studentData={studentData}
                currentUser={currentUser}
                sessionKey={activeSessionId}
                initialMessages={activeSession.messages}
                initialBackendSessionId={activeSession.backendSessionId}
                onMessagesUpdate={handleSessionUpdate}
                onCitationsChange={handleCitationsChange}
              />
            )}
          </div>
          {pdfViewerOpen && (
            <>
              {/* Desktop/tablet: side-by-side panel */}
              <div className="hidden md:flex md:flex-1 min-w-0">
                <PdfViewerPanel
                  citations={activeCitations}
                  documents={moduleDocuments}
                  documentsLoading={documentsLoading}
                  moduleId={studentData.moduleId}
                  onClose={() => setPdfViewerOpen(false)}
                />
              </div>

              {/* Mobile: modal overlay */}
              <div className="fixed inset-0 z-50 md:hidden">
                <div
                  className="absolute inset-0 bg-black/30"
                  onClick={() => setPdfViewerOpen(false)}
                  role="button"
                  tabIndex={-1}
                />
                <div className="relative h-full w-full bg-[var(--color-bg-canvas)]">
                  <PdfViewerPanel
                    citations={activeCitations}
                    documents={moduleDocuments}
                    documentsLoading={documentsLoading}
                    moduleId={studentData.moduleId}
                    onClose={() => setPdfViewerOpen(false)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {mobileSessionsOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            role="button"
            tabIndex={-1}
            onClick={closeMobileSessions}
          />
          <div className="relative h-full w-full bg-[var(--color-bg-canvas)]">
            <StudentSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => selectSession(id)}
              onNewSession={handleNewSession}
              onRenameSession={handleRenameSession}
              onDeleteSession={handleDeleteSession}
              onClearAllHistory={isAuthenticated ? handleClearAllHistory : null}
              moduleName={studentData.moduleName}
              teacherName={teacherName}
              mobileFullScreen
              onClose={closeMobileSessions}
            />
          </div>
        </div>
      )}
    </div>
  )
}
