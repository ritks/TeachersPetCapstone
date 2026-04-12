import { useEffect, useState } from 'react'
import AnalyticsDashboard from '../AnalyticsDashboard'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { Badge, Button, Card, Input, Panel } from '../ui/primitives'
import LogoMark from '../common/LogoMark'

function DashboardStat({ label, value, tone }) {
  const tones = {
    blue: 'from-[rgba(65,90,119,0.28)] to-[rgba(65,90,119,0.12)] text-[var(--color-primary-700)]',
    purple: 'from-[rgba(65,90,119,0.24)] to-[rgba(27,38,59,0.12)] text-[var(--color-primary-700)]',
    amber: 'from-[rgba(65,90,119,0.2)] to-[rgba(248,249,250,0.28)] text-[var(--color-primary-700)]',
    green: 'from-[rgba(45,106,79,0.22)] to-[rgba(65,90,119,0.12)] text-[var(--color-primary-700)]',
  }

  return (
    <Card className="p-4 border-[rgba(65,90,119,0.22)] bg-[linear-gradient(145deg,rgba(236,241,246,0.9),rgba(225,233,242,0.72))] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tones[tone]} flex items-center justify-center font-bold text-lg`}>
          {value}
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
      </div>
    </Card>
  )
}

function DashboardCard({ title, description, icon, tag, tagTone = 'neutral', cta = 'Open', onClick }) {
  const ctaText = onClick ? `${cta} →` : 'Coming soon →'
  return (
    <Card
      interactive
      onClick={onClick}
      className={[
        'p-5 border-[rgba(65,90,119,0.22)] bg-[linear-gradient(150deg,rgba(236,241,246,0.9),rgba(223,232,242,0.72))] backdrop-blur-sm group',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg border border-[rgba(65,90,119,0.24)] bg-[rgba(248,249,250,0.72)] flex items-center justify-center text-[var(--color-primary-700)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </div>
        <Badge tone={tagTone}>{tag}</Badge>
      </div>

      <h3 className="text-[1.02rem] leading-tight font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mt-2 min-h-[3.5rem]">
        {description}
      </p>
      <p className="text-sm font-semibold text-[var(--color-brand-600)] mt-4 group-hover:text-[var(--color-brand-700)] transition-colors">
        {ctaText}
      </p>
    </Card>
  )
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function getUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode()
    const snap = await getDoc(doc(db, 'courseCodes', code))
    if (!snap.exists()) return code
  }
  throw new Error('Could not generate a unique course code.')
}

function ClassManagementPanel({ currentUser }) {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [modulesByClass, setModulesByClass] = useState({})
  const [courseCodes, setCourseCodes] = useState({})
  const [insightsByClass, setInsightsByClass] = useState({})
  const [showCreateClassForm, setShowCreateClassForm] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassDesc, setNewClassDesc] = useState('')
  const [moduleDrafts, setModuleDrafts] = useState({})
  const [creatingModuleForClass, setCreatingModuleForClass] = useState(null)
  const [generatingForModule, setGeneratingForModule] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const localClassesKey = currentUser ? `tp_teacher_classes_${currentUser.uid}` : null
  const localLinksKey = currentUser ? `tp_class_modules_${currentUser.uid}` : null

  const readLocal = (key, fallback = []) => {
    try {
      if (!key || typeof window === 'undefined') return fallback
      const raw = window.localStorage.getItem(key)
      if (!raw) return fallback
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }

  const writeLocal = (key, value) => {
    try {
      if (!key || typeof window === 'undefined') return
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // noop
    }
  }

  const getModuleDraft = (classId) => moduleDrafts[classId] || { name: '', description: '', open: false }

  const updateModuleDraft = (classId, patch) => {
    setModuleDrafts((prev) => ({
      ...prev,
      [classId]: { ...getModuleDraft(classId), ...patch },
    }))
  }

  const refreshData = async () => {
    if (!currentUser) return
    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      const settled = await Promise.allSettled([
        fetch(`http://localhost:8000/modules?teacher_uid=${encodeURIComponent(currentUser.uid)}`),
        getDocs(query(collection(db, 'teacherClasses'), where('teacherUid', '==', currentUser.uid))),
        getDocs(query(collection(db, 'classModules'), where('teacherUid', '==', currentUser.uid))),
        getDocs(query(collection(db, 'courseCodes'), where('teacherUid', '==', currentUser.uid))),
        getDocs(query(collection(db, 'prompts'), where('teacherUid', '==', currentUser.uid))),
      ])

      const [moduleResState, classesState, classModulesState, codesState, promptsState] = settled

      const moduleData = moduleResState.status === 'fulfilled'
        ? await moduleResState.value.json()
        : []
      const modules = Array.isArray(moduleData) ? moduleData : []
      const moduleMap = {}
      modules.forEach((mod) => { moduleMap[mod.id] = mod })

      const remoteClassItems = classesState.status === 'fulfilled'
        ? classesState.value.docs.map((d) => ({ id: d.id, ...d.data() }))
        : []
      const localClassItems = readLocal(localClassesKey, [])
      const classMap = {}
      remoteClassItems.forEach((c) => { classMap[c.id] = c })
      localClassItems.forEach((c) => { classMap[c.id] = c })
      const classItems = Object.values(classMap)
      classItems.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tb = b.createdAt?.toMillis?.() ?? 0
        return tb - ta
      })
      setClasses(classItems)

      const moduleGroups = {}
      const classModuleDocs = classModulesState.status === 'fulfilled' ? classModulesState.value.docs : []
      const remoteLinks = classModuleDocs.map((d) => d.data())
      const localLinks = readLocal(localLinksKey, [])
      const allLinks = [...remoteLinks, ...localLinks]
      allLinks.forEach((data) => {
        if (!data.classId || !data.moduleId || !moduleMap[data.moduleId]) return
        if (!moduleGroups[data.classId]) moduleGroups[data.classId] = []
        moduleGroups[data.classId].push(moduleMap[data.moduleId])
      })
      Object.keys(moduleGroups).forEach((classId) => {
        moduleGroups[classId].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      })
      setModulesByClass(moduleGroups)

      const codeMap = {}
      const codeDocs = codesState.status === 'fulfilled' ? codesState.value.docs : []
      codeDocs.forEach((d) => {
        const data = d.data()
        if (data.moduleId) codeMap[data.moduleId] = d.id
      })
      setCourseCodes(codeMap)

      const promptDocs = promptsState.status === 'fulfilled' ? promptsState.value.docs.map((d) => d.data()) : []
      const classInsights = {}
      classItems.forEach((classItem) => {
        const classModules = moduleGroups[classItem.id] || []
        const moduleIds = new Set(classModules.map((m) => m.id))
        const classPrompts = promptDocs.filter((p) => p.moduleId && moduleIds.has(p.moduleId))
        const activeStudents = new Set(
          classPrompts
            .map((p) => p.courseCode || p.sessionId)
            .filter(Boolean),
        ).size
        const latestTs = classPrompts.reduce((acc, p) => {
          const val = p.timestamp?.toMillis?.() ?? 0
          return val > acc ? val : acc
        }, 0)

        classInsights[classItem.id] = {
          modules: classModules.length,
          activeStudents,
          totalPrompts: classPrompts.length,
          latestTs,
        }
      })
      setInsightsByClass(classInsights)

      if (classesState.status === 'rejected' || moduleResState.status === 'rejected') {
        setErrorMessage('Some class data could not be loaded. Please refresh and try again.')
      }
      if (classesState.status === 'rejected' || classModulesState.status === 'rejected') {
        setInfoMessage('Using local class storage because cloud class permissions are limited.')
      }
    } catch {
      setErrorMessage('Unable to load class data right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [currentUser])

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!currentUser || creatingClass) return
    const name = newClassName.trim()
    if (!name) return

    setCreatingClass(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      try {
        await addDoc(collection(db, 'teacherClasses'), {
          name,
          description: newClassDesc.trim() || null,
          teacherUid: currentUser.uid,
          teacherName: currentUser.displayName || currentUser.email || null,
          createdAt: serverTimestamp(),
        })
      } catch {
        const localClasses = readLocal(localClassesKey, [])
        const localClass = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          description: newClassDesc.trim() || null,
          teacherUid: currentUser.uid,
          teacherName: currentUser.displayName || currentUser.email || null,
          createdAt: Date.now(),
        }
        writeLocal(localClassesKey, [localClass, ...localClasses])
        setInfoMessage('Class saved locally (cloud permissions blocked).')
      }
      setNewClassName('')
      setNewClassDesc('')
      setShowCreateClassForm(false)
      await refreshData()
    } catch {
      setErrorMessage('Could not create class. Please try again.')
    } finally {
      setCreatingClass(false)
    }
  }

  const handleCreateModuleForClass = async (classId) => {
    if (!currentUser || creatingModuleForClass) return
    const draft = getModuleDraft(classId)
    const name = draft.name.trim()
    if (!name) return

    setCreatingModuleForClass(classId)
    try {
      const response = await fetch('http://localhost:8000/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: draft.description.trim() || undefined,
          teacher_uid: currentUser.uid,
        }),
      })
      const created = await response.json()

      if (created?.id) {
        try {
          await addDoc(collection(db, 'classModules'), {
            classId,
            moduleId: created.id,
            moduleName: created.name,
            teacherUid: currentUser.uid,
            createdAt: serverTimestamp(),
          })
        } catch {
          const localLinks = readLocal(localLinksKey, [])
          localLinks.unshift({
            classId,
            moduleId: created.id,
            moduleName: created.name,
            teacherUid: currentUser.uid,
            createdAt: Date.now(),
          })
          writeLocal(localLinksKey, localLinks)
          setInfoMessage('Module linked locally to class (cloud permissions blocked).')
        }
      }

      updateModuleDraft(classId, { name: '', description: '', open: false })
      await refreshData()
    } finally {
      setCreatingModuleForClass(null)
    }
  }

  const handleGenerateCode = async (moduleItem, classId) => {
    if (!currentUser) return
    setGeneratingForModule(moduleItem.id)
    try {
      const code = await getUniqueCode()
      await setDoc(doc(db, 'courseCodes', code), {
        moduleId: moduleItem.id,
        moduleName: moduleItem.name,
        classId,
        className: classes.find((c) => c.id === classId)?.name || null,
        teacherUid: currentUser.uid,
        teacherName: currentUser.displayName || currentUser.email || null,
        createdAt: serverTimestamp(),
      })
      setCourseCodes((prev) => ({ ...prev, [moduleItem.id]: code }))
      await refreshData()
    } finally {
      setGeneratingForModule(null)
    }
  }

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 1800)
    } catch {
      // noop
    }
  }

  const formatLatestActivity = (tsMillis) => {
    if (!tsMillis) return 'No student activity yet'
    return `Last activity ${new Date(tsMillis).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
  }

  return (
    <Panel className="p-5 md:p-6 bg-[linear-gradient(152deg,rgba(236,243,250,0.9),rgba(221,232,244,0.76))] border-[rgba(65,90,119,0.24)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Class Management</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Create classes, add modules, generate join codes, and review class-level insights.
          </p>
        </div>
        {!showCreateClassForm && (
          <Button onClick={() => setShowCreateClassForm(true)} variant="primary" size="md">
            + Create New Class
          </Button>
        )}
      </div>

      {showCreateClassForm && (
        <form onSubmit={handleCreateClass} className="mb-6 rounded-xl border border-[rgba(65,90,119,0.24)] bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">New Class</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <Input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Class name (e.g. Algebra 1)" required />
            <Input value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} placeholder="Description (optional)" />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="md" disabled={creatingClass || !newClassName.trim()}>
                {creatingClass ? 'Creating...' : 'Create Class'}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => setShowCreateClassForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      {!!errorMessage && (
        <div className="mb-4 rounded-lg border border-[rgba(220,38,38,0.25)] bg-[rgba(254,242,242,0.8)] px-3 py-2 text-sm text-[var(--color-danger-600)]">
          {errorMessage}
        </div>
      )}
      {!!infoMessage && (
        <div className="mb-4 rounded-lg border border-[rgba(65,90,119,0.22)] bg-[rgba(248,249,250,0.84)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          {infoMessage}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--color-text-secondary)]">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgba(65,90,119,0.3)] bg-white/55 p-6 text-sm text-[var(--color-text-secondary)]">
          No classes yet. Start by creating your first class.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {classes.map((classItem) => {
            const classModules = modulesByClass[classItem.id] || []
            const insight = insightsByClass[classItem.id] || { modules: 0, activeStudents: 0, totalPrompts: 0, latestTs: 0 }
            const draft = getModuleDraft(classItem.id)

            return (
              <Card key={classItem.id} className="p-5 border-[rgba(65,90,119,0.24)] bg-[linear-gradient(150deg,rgba(236,241,246,0.92),rgba(223,232,242,0.78))]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{classItem.name}</h4>
                    {classItem.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{classItem.description}</p>
                    )}
                  </div>
                  <Badge tone="brand">Class</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 px-3 py-2">
                    <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Modules</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.modules}</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 px-3 py-2">
                    <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Active Students</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.activeStudents}</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 px-3 py-2">
                    <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Insights</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.totalPrompts}</p>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] mt-3">{formatLatestActivity(insight.latestTs)}</p>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Modules</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => updateModuleDraft(classItem.id, { open: !draft.open })}
                  >
                    {draft.open ? 'Close' : '+ New Module'}
                  </Button>
                </div>

                {draft.open && (
                  <div className="mt-3 rounded-xl border border-[rgba(65,90,119,0.22)] bg-white/80 p-3">
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        value={draft.name}
                        onChange={(e) => updateModuleDraft(classItem.id, { name: e.target.value })}
                        placeholder="Module name"
                      />
                      <Input
                        value={draft.description}
                        onChange={(e) => updateModuleDraft(classItem.id, { description: e.target.value })}
                        placeholder="Module description (optional)"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="w-fit"
                        disabled={!draft.name.trim() || creatingModuleForClass === classItem.id}
                        onClick={() => handleCreateModuleForClass(classItem.id)}
                      >
                        {creatingModuleForClass === classItem.id ? 'Creating...' : 'Create Module'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {classModules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                      No modules yet for this class.
                    </div>
                  ) : (
                    classModules.map((moduleItem) => {
                      const code = courseCodes[moduleItem.id]
                      const isGenerating = generatingForModule === moduleItem.id

                      return (
                        <div key={moduleItem.id} className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{moduleItem.name}</p>
                              {moduleItem.description && (
                                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{moduleItem.description}</p>
                              )}
                            </div>
                            <Badge tone="neutral">Module</Badge>
                          </div>

                          <div className="mt-2.5 flex items-center gap-2">
                            {code ? (
                              <>
                                <Badge tone="brand" className="font-mono tracking-[0.16em] text-[0.76rem] px-3 py-1.5">{code}</Badge>
                                <Button type="button" variant="secondary" size="sm" onClick={() => handleCopyCode(code)}>
                                  {copiedCode === code ? 'Copied' : 'Copy'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleGenerateCode(moduleItem, classItem.id)}
                                disabled={isGenerating}
                              >
                                {isGenerating ? 'Generating...' : 'Generate Code'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

export default function TeacherDashboard({ onLogout, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview')
  const firstName = currentUser?.displayName?.split(' ')[0] || null

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[var(--color-bg-canvas)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(65,90,119,0.34),rgba(65,90,119,0)_54%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(27,38,59,0.14),rgba(27,38,59,0.02)_42%,rgba(65,90,119,0.2)_100%)]" />

      <header className="relative z-10 border-b border-[rgba(65,90,119,0.24)] bg-[linear-gradient(180deg,rgba(248,249,250,0.86),rgba(233,240,247,0.76))] backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark containerClassName="w-10 h-10 rounded-xl bg-[var(--color-brand-50)] border border-[var(--color-brand-100)] p-1" />
            <div>
              <p className="text-[0.95rem] font-semibold text-[var(--color-text-primary)]">Teacher Dashboard</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {currentUser?.displayName || currentUser?.email || "Teacher's Pet"}
              </p>
            </div>
          </div>
          <Button onClick={onLogout} variant="secondary" size="md">
            Logout
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-[1240px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
          <aside className="lg:sticky lg:top-24 h-fit">
            <Panel className="p-5 bg-[linear-gradient(145deg,#1b2a46,#233a5f_52%,#2e4b72_100%)] border-white/25 shadow-[0_18px_36px_rgba(27,38,59,0.3)] backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-[rgba(236,241,246,0.74)] mb-2">Workspace</p>
              <h2 className="text-[2rem] font-semibold leading-[1.08] text-white">
                Welcome back{firstName ? `, ${firstName}` : ''}.
              </h2>
              <p className="text-[1.05rem] leading-relaxed text-[rgba(236,241,246,0.88)] mt-4">
                Monitor engagement, review student activity, and manage your class content in one place.
              </p>

              <div className="mt-5 rounded-[1.75rem] border border-white/25 bg-white/12 p-2 flex flex-col gap-1.5">
                <Button
                  onClick={() => setActiveTab('overview')}
                  variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
                  size="md"
                  className={activeTab === 'overview'
                    ? 'bg-white text-[var(--color-primary-700)] border-white/90 shadow-[0_10px_20px_rgba(15,23,42,0.28)] justify-start'
                    : 'justify-start font-medium text-white bg-[rgba(236,241,246,0.1)] border border-white/20 hover:bg-[rgba(236,241,246,0.18)]'
                  }
                >
                  Overview
                </Button>
                <Button
                  onClick={() => setActiveTab('analytics')}
                  variant={activeTab === 'analytics' ? 'secondary' : 'ghost'}
                  size="md"
                  className={activeTab === 'analytics'
                    ? 'bg-white text-[var(--color-primary-700)] border-white/90 shadow-[0_10px_20px_rgba(15,23,42,0.28)] justify-start'
                    : 'justify-start font-medium text-white bg-[rgba(236,241,246,0.1)] border border-white/20 hover:bg-[rgba(236,241,246,0.18)]'
                  }
                >
                  Analytics
                </Button>
                <Button
                  onClick={() => setActiveTab('classes')}
                  variant={activeTab === 'classes' ? 'secondary' : 'ghost'}
                  size="md"
                  className={activeTab === 'classes'
                    ? 'bg-white text-[var(--color-primary-700)] border-white/90 shadow-[0_10px_20px_rgba(15,23,42,0.28)] justify-start'
                    : 'justify-start font-medium text-white bg-[rgba(236,241,246,0.1)] border border-white/20 hover:bg-[rgba(236,241,246,0.18)]'
                  }
                >
                  Class Management
                </Button>
              </div>
            </Panel>
          </aside>

          <section className="space-y-6">
            {activeTab === 'analytics' ? (
              <Panel className="p-5 md:p-6 bg-[linear-gradient(152deg,rgba(236,243,250,0.9),rgba(221,232,244,0.76))] border-[rgba(65,90,119,0.24)] backdrop-blur-sm">
                <AnalyticsDashboard />
              </Panel>
            ) : activeTab === 'classes' ? (
              <ClassManagementPanel currentUser={currentUser} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <DashboardStat label="Active Students" value="--" tone="blue" />
                  <DashboardStat label="Modules" value="--" tone="purple" />
                  <DashboardStat label="Documents" value="--" tone="amber" />
                  <DashboardStat label="Chat Sessions" value="--" tone="green" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <DashboardCard
                    title="Student Performance"
                    description="Review trends, common struggle points, and learning progress across your class."
                    icon={<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />}
                    tag="Analytics"
                    tagTone="brand"
                    cta="Open analytics"
                    onClick={() => setActiveTab('analytics')}
                  />
                  <DashboardCard
                    title="Manage Modules"
                    description="Create and maintain your module catalog, descriptions, and learning objectives."
                    icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                    tag="Content"
                    tagTone="brand"
                  />
                  <DashboardCard
                    title="Upload Textbooks"
                    description="Upload PDF or text resources and enrich lesson support for student Q&A."
                    icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>}
                    tag="Upload"
                    tagTone="warning"
                  />
                <DashboardCard
                  title="Manage Classes"
                  description="Organize students into groups, assign content, and track class-level progress."
                  icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
                  tag="Classes"
                  tagTone="success"
                  cta="Open class management"
                  onClick={() => setActiveTab('classes')}
                />
                  <DashboardCard
                    title="Review Chat Logs"
                    description="See real student prompts and tutor responses to improve instruction quality."
                    icon={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
                    tag="Sessions"
                    tagTone="brand"
                    cta="Open analytics"
                    onClick={() => setActiveTab('analytics')}
                  />
                  <DashboardCard
                    title="Settings"
                    description="Configure account preferences and tune classroom-level controls."
                    icon={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
                    tag="Admin"
                    tagTone="neutral"
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
