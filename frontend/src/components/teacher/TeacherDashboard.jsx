import { useEffect, useMemo, useState } from 'react'
import AnalyticsDashboard from '../AnalyticsDashboard'
import { Badge, Button, Card, Input, Panel, StatCard } from '../ui/primitives'
import LogoMark from '../common/LogoMark'
import { apiUrl } from '../../lib/api'
import { apiFetch } from '../../lib/apiAuth'
import DocumentPanel from './DocumentPanel'
import ThemeToggleButton from '../common/ThemeToggleButton'

function DashboardCard({ title, description, icon, tag, tagTone = 'neutral', cta = 'Open', onClick }) {
  const ctaText = onClick ? `${cta} →` : 'Coming soon →'
  return (
    <Card
      interactive
      onClick={onClick}
      className={[
        'p-5 border-[var(--color-border-card)] tp-card-surface backdrop-blur-sm group',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg border border-[var(--color-border-card-subtle)] bg-[var(--color-bg-muted)] flex items-center justify-center text-[var(--color-text-secondary)]">
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

function ClassManagementPanel({ currentUser }) {
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [modulesByClass, setModulesByClass] = useState({})
  const [documentsByModule, setDocumentsByModule] = useState({})
  const [openDocumentsByModule, setOpenDocumentsByModule] = useState({})
  const [insightsByClass, setInsightsByClass] = useState({})
  const [showCreateClassForm, setShowCreateClassForm] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassDesc, setNewClassDesc] = useState('')
  const [moduleDrafts, setModuleDrafts] = useState({})
  const [creatingModuleForClass, setCreatingModuleForClass] = useState(null)
  const [moduleAccessByKey, setModuleAccessByKey] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [studentsByClass, setStudentsByClass] = useState({})
  const [studentDraftByClass, setStudentDraftByClass] = useState({})
  const [addingStudentForClass, setAddingStudentForClass] = useState(null)
  const [groupsByClass, setGroupsByClass] = useState({})
  const [moduleGroupAccess, setModuleGroupAccess] = useState({})
  const [groupDraftByClass, setGroupDraftByClass] = useState({})
  const [creatingGroupForClass, setCreatingGroupForClass] = useState(null)
  const [classDetailTab, setClassDetailTab] = useState('roster')
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [editingModuleDescriptionId, setEditingModuleDescriptionId] = useState(null)
  const [editingModuleDescriptionValue, setEditingModuleDescriptionValue] = useState('')
  const [savingModuleDescriptionId, setSavingModuleDescriptionId] = useState(null)
  const [editingModuleNameId, setEditingModuleNameId] = useState(null)
  const [editingModuleNameValue, setEditingModuleNameValue] = useState('')
  const [savingModuleNameId, setSavingModuleNameId] = useState(null)
  const [editingGroupNameId, setEditingGroupNameId] = useState(null)
  const [editingGroupNameValue, setEditingGroupNameValue] = useState('')
  const [savingGroupNameId, setSavingGroupNameId] = useState(null)
  const [deletingStudentEmail, setDeletingStudentEmail] = useState(null)
  const [deletingGroupId, setDeletingGroupId] = useState(null)
  const [deletingModuleId, setDeletingModuleId] = useState(null)
  const [moduleSearchTerm, setModuleSearchTerm] = useState('')
  const [moduleStatusFilter, setModuleStatusFilter] = useState('all')
  const [classStatusFilter, setClassStatusFilter] = useState('active')
  const [archivingClassId, setArchivingClassId] = useState(null)
  const [deletingClassId, setDeletingClassId] = useState(null)

  const localClassesKey = currentUser ? `tp_teacher_classes_${currentUser.uid}` : null
  const localLinksKey = currentUser ? `tp_class_modules_${currentUser.uid}` : null
  const localStudentsKey = currentUser ? `tp_class_students_${currentUser.uid}` : null
  const localAccessKey = currentUser ? `tp_module_access_${currentUser.uid}` : null
  const localGroupsKey = currentUser ? `tp_class_groups_${currentUser.uid}` : null
  const localGroupAccessKey = currentUser ? `tp_module_group_access_${currentUser.uid}` : null

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

  const purgeLocalClassData = (classId) => {
    writeLocal(localClassesKey, readLocal(localClassesKey, []).filter((row) => row.id !== classId))
    writeLocal(localLinksKey, readLocal(localLinksKey, []).filter((row) => row.classId !== classId))
    writeLocal(localStudentsKey, readLocal(localStudentsKey, []).filter((row) => row.classId !== classId))
    writeLocal(localGroupsKey, readLocal(localGroupsKey, []).filter((row) => row.classId !== classId))
    writeLocal(localAccessKey, readLocal(localAccessKey, []).filter((row) => row.classId !== classId))
    writeLocal(localGroupAccessKey, readLocal(localGroupAccessKey, []).filter((row) => row.classId !== classId))
  }

  const getModuleDraft = (classId) => moduleDrafts[classId] || { name: '', description: '', open: false }

  const updateModuleDraft = (classId, patch) => {
    setModuleDrafts((prev) => ({
      ...prev,
      [classId]: { ...getModuleDraft(classId), ...patch },
    }))
  }

  const getStudentDraft = (classId) => studentDraftByClass[classId] || ''
  const updateStudentDraft = (classId, value) => {
    setStudentDraftByClass((prev) => ({ ...prev, [classId]: value }))
  }
  const getGroupDraft = (classId) => groupDraftByClass[classId] || ''
  const updateGroupDraft = (classId, value) => {
    setGroupDraftByClass((prev) => ({ ...prev, [classId]: value }))
  }

  const moduleGroupKey = (classId, moduleId) => `${classId}::${moduleId}`
  const moduleStudentKey = (classId, moduleId, studentEmail) => `${classId}::${moduleId}::${studentEmail}`

  const fetchDocumentsForModule = async (moduleId) => {
    try {
      const res = await fetch(apiUrl(`/modules/${moduleId}/documents`))
      const data = await res.json()
      const docs = Array.isArray(data) ? data : []
      setDocumentsByModule((prev) => ({ ...prev, [moduleId]: docs }))
      return docs
    } catch {
      setDocumentsByModule((prev) => ({ ...prev, [moduleId]: [] }))
      return []
    }
  }

  const refreshAllOpenDocuments = async () => {
    const moduleIds = Object.entries(openDocumentsByModule)
      .filter(([, isOpen]) => Boolean(isOpen))
      .map(([moduleId]) => moduleId)
    if (moduleIds.length === 0) return
    await Promise.all(moduleIds.map((moduleId) => fetchDocumentsForModule(moduleId)))
  }

  const refreshData = async () => {
    if (!currentUser) return
    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      const uid = encodeURIComponent(currentUser.uid)
      const settled = await Promise.allSettled([
        fetch(apiUrl(`/modules?teacher_uid=${uid}`)),
        apiFetch('/classes', { user: currentUser }),
        apiFetch(`/class-modules?teacher_uid=${uid}`, { user: currentUser }),
        apiFetch(`/prompts?teacher_uid=${uid}`, { user: currentUser }),
        apiFetch(`/class-students?teacher_uid=${uid}`, { user: currentUser }),
        apiFetch(`/module-access?teacher_uid=${uid}`, { user: currentUser }),
        apiFetch(`/class-groups?teacher_uid=${uid}`, { user: currentUser }),
        apiFetch(`/module-group-access?teacher_uid=${uid}`, { user: currentUser }),
      ])

      const [
        moduleResState,
        classesState,
        classModulesState,
        promptsState,
        studentsState,
        accessState,
        groupsState,
        groupAccessState,
      ] = settled

      const moduleData = moduleResState.status === 'fulfilled'
        ? await moduleResState.value.json()
        : []
      const modules = Array.isArray(moduleData) ? moduleData : []
      const moduleMap = {}
      modules.forEach((mod) => { moduleMap[mod.id] = mod })

      const remoteClassItems = classesState.status === 'fulfilled'
        ? classesState.value.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            teacherUid: c.teacher_uid,
            teacherName: c.teacher_name,
            status: c.status || 'active',
            createdAt: c.created_at
              ? { toMillis: () => new Date(c.created_at).getTime() }
              : null,
          }))
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
      const remoteLinks = classModulesState.status === 'fulfilled' ? classModulesState.value : []
      const localLinks = readLocal(localLinksKey, [])
      const allLinks = [...remoteLinks, ...localLinks]
      allLinks.forEach((data) => {
        if (!data.classId || !data.moduleId || !moduleMap[data.moduleId]) return
        if (!moduleGroups[data.classId]) moduleGroups[data.classId] = []
        moduleGroups[data.classId].push({
          ...moduleMap[data.moduleId],
          classModuleDocId: data.id || null,
          moduleStatus: data.moduleStatus || 'active',
        })
      })
      Object.keys(moduleGroups).forEach((classId) => {
        moduleGroups[classId].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      })
      setModulesByClass(moduleGroups)

      const remoteStudents = studentsState.status === 'fulfilled' ? studentsState.value : []
      const localStudents = readLocal(localStudentsKey, [])
      const allStudents = [...remoteStudents, ...localStudents]
      const studentMapByClass = {}
      allStudents.forEach((row) => {
        if (!row.classId || !row.studentEmail) return
        if (!studentMapByClass[row.classId]) studentMapByClass[row.classId] = []
        const exists = studentMapByClass[row.classId].some((s) => s.studentEmail === row.studentEmail)
        if (!exists) studentMapByClass[row.classId].push(row)
      })
      setStudentsByClass(studentMapByClass)

      const remoteAccess = accessState.status === 'fulfilled' ? accessState.value : []
      const localAccess = readLocal(localAccessKey, [])
      const accessMap = {}
      ;[...remoteAccess, ...localAccess].forEach((row) => {
        if (!row.classId || !row.moduleId || !row.studentEmail) return
        accessMap[moduleStudentKey(row.classId, row.moduleId, row.studentEmail)] = {
          isUnlocked: Boolean(row.isUnlocked),
          source: row.source || 'group',
        }
      })
      setModuleAccessByKey(accessMap)

      const remoteGroups = groupsState.status === 'fulfilled' ? groupsState.value : []
      const localGroups = readLocal(localGroupsKey, [])
      const groupMap = {}
      ;[...remoteGroups, ...localGroups].forEach((row) => {
        if (!row.classId || !row.name) return
        const id = row.id || `local-group-${row.classId}-${row.name}`
        groupMap[id] = {
          id,
          classId: row.classId,
          name: row.name,
          members: Array.isArray(row.members) ? row.members.filter(Boolean) : [],
        }
      })
      const nextGroupsByClass = {}
      Object.values(groupMap).forEach((groupItem) => {
        if (!nextGroupsByClass[groupItem.classId]) nextGroupsByClass[groupItem.classId] = []
        nextGroupsByClass[groupItem.classId].push(groupItem)
      })
      Object.keys(nextGroupsByClass).forEach((classId) => {
        nextGroupsByClass[classId].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      })
      setGroupsByClass(nextGroupsByClass)

      const remoteGroupAccess = groupAccessState.status === 'fulfilled' ? groupAccessState.value : []
      const localGroupAccess = readLocal(localGroupAccessKey, [])
      const groupAccessMap = {}
      ;[...remoteGroupAccess, ...localGroupAccess].forEach((row) => {
        if (!row.classId || !row.moduleId) return
        groupAccessMap[moduleGroupKey(row.classId, row.moduleId)] = Array.isArray(row.groupIds)
          ? [...new Set(row.groupIds.filter(Boolean))]
          : []
      })
      setModuleGroupAccess(groupAccessMap)

      const promptDocs = promptsState.status === 'fulfilled' ? promptsState.value : []
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
          const val = p.timestamp
            ? (p.timestamp?.toMillis?.() ?? new Date(p.timestamp).getTime())
            : 0
          return val > acc ? val : acc
        }, 0)

        classInsights[classItem.id] = {
          modules: classModules.length,
          activeStudents: studentMapByClass[classItem.id]?.length ?? activeStudents,
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
      if (studentsState.status === 'rejected' || accessState.status === 'rejected') {
        setInfoMessage('Some student roster permissions are limited. Local fallback is active.')
      }
      if (groupsState.status === 'rejected' || groupAccessState.status === 'rejected') {
        setInfoMessage('Some group assignment permissions are limited. Local fallback is active.')
      }
    } catch {
      setErrorMessage('Unable to load class data right now. Please try again.')
    } finally {
      setLoading(false)
      // Keep docs in sync for any currently-open panels.
      await refreshAllOpenDocuments()
    }
  }

  useEffect(() => {
    refreshData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  useEffect(() => {
    if (!selectedClassId) return
    if (!classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(null)
    }
  }, [classes, selectedClassId])

  useEffect(() => {
    if (!selectedClassId) {
      setClassDetailTab('roster')
    }
  }, [selectedClassId])

  useEffect(() => {
    setModuleSearchTerm('')
    setModuleStatusFilter('all')
  }, [selectedClassId])

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
        await apiFetch('/classes', {
          user: currentUser,
          method: 'POST',
          body: { name, description: newClassDesc.trim() || null },
        })
      } catch {
        const localClasses = readLocal(localClassesKey, [])
        const localClass = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          description: newClassDesc.trim() || null,
          teacherUid: currentUser.uid,
          teacherName: currentUser.displayName || currentUser.email || null,
          status: 'active',
          createdAt: Date.now(),
        }
        writeLocal(localClassesKey, [localClass, ...localClasses])
        setInfoMessage('Class saved locally (API unavailable).')
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

  const handleToggleClassArchive = async (classItem) => {
    if (!currentUser || !classItem?.id) return
    const nextStatus = (classItem.status || 'active') === 'archived' ? 'active' : 'archived'

    setArchivingClassId(classItem.id)
    setErrorMessage('')
    setInfoMessage('')

    try {
      try {
        if (!String(classItem.id).startsWith('local-')) {
          await apiFetch(`/classes/${classItem.id}`, {
            user: currentUser,
            method: 'PUT',
            body: { status: nextStatus },
          })
        } else {
          throw new Error('Local class')
        }
      } catch {
        const localClasses = readLocal(localClassesKey, [])
        const idx = localClasses.findIndex((row) => row.id === classItem.id)
        if (idx >= 0) {
          localClasses[idx] = { ...localClasses[idx], status: nextStatus, updatedAt: Date.now() }
          writeLocal(localClassesKey, localClasses)
        }
        setInfoMessage('Class status saved locally (API unavailable).')
      }

      setClasses((prev) => prev.map((row) => (
        row.id === classItem.id ? { ...row, status: nextStatus } : row
      )))

      if (nextStatus === 'archived' && selectedClassId === classItem.id) {
        setSelectedClassId(null)
      }
    } catch {
      setErrorMessage('Could not update class archive status.')
    } finally {
      setArchivingClassId(null)
    }
  }

  const handleDeleteClass = async (classItem) => {
    if (!currentUser || !classItem?.id) return
    if (!window.confirm(
      `Delete class "${classItem.name}"? This removes roster, groups, and module links. Module content is kept. This cannot be undone.`,
    )) return

    setDeletingClassId(classItem.id)
    setErrorMessage('')
    setInfoMessage('')

    try {
      const isLocal = String(classItem.id).startsWith('local-')
      if (isLocal) {
        purgeLocalClassData(classItem.id)
        setInfoMessage('Class removed locally.')
      } else {
        await apiFetch(`/classes/${classItem.id}`, {
          user: currentUser,
          method: 'DELETE',
        })
        purgeLocalClassData(classItem.id)
      }

      setClasses((prev) => prev.filter((row) => row.id !== classItem.id))
      setModulesByClass((prev) => {
        const next = { ...prev }
        delete next[classItem.id]
        return next
      })
      setStudentsByClass((prev) => {
        const next = { ...prev }
        delete next[classItem.id]
        return next
      })
      setGroupsByClass((prev) => {
        const next = { ...prev }
        delete next[classItem.id]
        return next
      })
      setInsightsByClass((prev) => {
        const next = { ...prev }
        delete next[classItem.id]
        return next
      })

      if (selectedClassId === classItem.id) {
        setSelectedClassId(null)
      }
    } catch {
      setErrorMessage('Could not delete class.')
    } finally {
      setDeletingClassId(null)
    }
  }

  const handleCreateModuleForClass = async (classId) => {
    if (!currentUser || creatingModuleForClass) return
    const draft = getModuleDraft(classId)
    const name = draft.name.trim()
    if (!name) return

    setCreatingModuleForClass(classId)
    try {
      const response = await fetch(apiUrl('/modules'), {
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
        const classRef = classes.find((c) => c.id === classId)
        try {
          await apiFetch('/class-modules', {
            user: currentUser,
            method: 'POST',
            body: {
              class_id: classId,
              module_id: created.id,
              module_status: 'active',
            },
          })
        } catch {
          const localLinks = readLocal(localLinksKey, [])
          localLinks.unshift({
            id: `local-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            classId,
            className: classRef?.name || null,
            moduleId: created.id,
            moduleName: created.name,
            moduleStatus: 'active',
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

  const handleStartEditModuleDescription = (moduleItem) => {
    setErrorMessage('')
    setInfoMessage('')
    setEditingModuleDescriptionId(moduleItem.id)
    setEditingModuleDescriptionValue(moduleItem.description || '')
  }

  const handleCancelEditModuleDescription = () => {
    setEditingModuleDescriptionId(null)
    setEditingModuleDescriptionValue('')
  }

  const handleStartEditModuleName = (moduleItem) => {
    setEditingModuleNameId(moduleItem.id)
    setEditingModuleNameValue(moduleItem.name || '')
  }

  const handleCancelEditModuleName = () => {
    setEditingModuleNameId(null)
    setEditingModuleNameValue('')
  }

  const handleSaveModuleName = async ({ classId, moduleItem }) => {
    if (!currentUser || !moduleItem?.id) return
    const trimmed = editingModuleNameValue.trim()
    if (!trimmed) return

    setErrorMessage('')
    setInfoMessage('')
    setSavingModuleNameId(moduleItem.id)

    try {
      const response = await fetch(apiUrl(`/modules/${moduleItem.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (!response.ok) {
        throw new Error(`Could not update module name (${response.status})`)
      }

      const updated = await response.json()
      setModulesByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((row) => (
          row.id === moduleItem.id ? { ...row, name: updated?.name ?? trimmed } : row
        )),
      }))

      setInfoMessage('Module name updated.')
      setEditingModuleNameId(null)
      setEditingModuleNameValue('')
    } catch {
      setErrorMessage('Could not update module name.')
    } finally {
      setSavingModuleNameId(null)
    }
  }

  const handleStartEditGroupName = (groupItem) => {
    setEditingGroupNameId(groupItem.id)
    setEditingGroupNameValue(groupItem.name || '')
  }

  const handleCancelEditGroupName = () => {
    setEditingGroupNameId(null)
    setEditingGroupNameValue('')
  }

  const handleSaveGroupName = async ({ classId, groupItem }) => {
    if (!currentUser || !groupItem?.id) return
    const trimmed = editingGroupNameValue.trim()
    if (!trimmed) return

    const duplicate = (groupsByClass[classId] || []).some(
      (g) => g.id !== groupItem.id && g.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      setErrorMessage('A group with that name already exists in this class.')
      return
    }

    setErrorMessage('')
    setInfoMessage('')
    setSavingGroupNameId(groupItem.id)

    try {
      try {
        if (!String(groupItem.id).startsWith('local-')) {
          await setDoc(doc(db, 'classGroups', groupItem.id), {
            name: trimmed,
            updatedAt: serverTimestamp(),
          }, { merge: true })
        } else {
          throw new Error('Local group')
        }
      } catch {
        const localGroups = readLocal(localGroupsKey, [])
        const idx = localGroups.findIndex((row) => row.id === groupItem.id)
        if (idx >= 0) {
          localGroups[idx] = { ...localGroups[idx], name: trimmed, updatedAt: Date.now() }
          writeLocal(localGroupsKey, localGroups)
        }
        setInfoMessage('Group name saved locally (cloud permissions blocked).')
      }

      setGroupsByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((row) => (
          row.id === groupItem.id ? { ...row, name: trimmed } : row
        )),
      }))

      setEditingGroupNameId(null)
      setEditingGroupNameValue('')
    } catch {
      setErrorMessage('Could not update group name.')
    } finally {
      setSavingGroupNameId(null)
    }
  }

  const handleSaveModuleDescription = async ({ classId, moduleItem }) => {
    if (!currentUser || !moduleItem?.id) return

    setErrorMessage('')
    setInfoMessage('')
    setSavingModuleDescriptionId(moduleItem.id)

    try {
      const response = await fetch(apiUrl(`/modules/${moduleItem.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editingModuleDescriptionValue.trim() || null,
        }),
      })

      if (!response.ok) {
        throw new Error(`Could not update module description (${response.status})`)
      }

      const updated = await response.json()
      setModulesByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((row) => (
          row.id === moduleItem.id
            ? { ...row, description: updated?.description ?? null }
            : row
        )),
      }))

      setInfoMessage('Module description updated.')
      setEditingModuleDescriptionId(null)
      setEditingModuleDescriptionValue('')
    } catch {
      setErrorMessage('Could not update module description.')
    } finally {
      setSavingModuleDescriptionId(null)
    }
  }

  const handleDeleteModule = async ({ classId, moduleItem }) => {
    if (!currentUser || !classId || !moduleItem?.id) return
    if (!window.confirm(`Delete module "${moduleItem.name}"? This will remove all documents and cannot be undone.`)) return

    setDeletingModuleId(moduleItem.id)
    setErrorMessage('')
    try {
      // 1. Delete from backend (removes documents + vector store)
      const res = await fetch(apiUrl(`/modules/${moduleItem.id}`), { method: 'DELETE' })
      if (!res.ok) throw new Error(`Backend delete failed (${res.status})`)

      // 2. Delete classModules Firestore doc
      try {
        if (moduleItem.classModuleDocId && !String(moduleItem.classModuleDocId).startsWith('local-')) {
          await deleteDoc(doc(db, 'classModules', moduleItem.classModuleDocId))
        } else {
          throw new Error('Local link')
        }
      } catch {
        const localLinks = readLocal(localLinksKey, [])
        writeLocal(localLinksKey, localLinks.filter(
          (row) => !(row.classId === classId && row.moduleId === moduleItem.id),
        ))
      }

      // 3. Clean up moduleGroupAccess for this module
      const accessDocId = `${classId}_${moduleItem.id}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 120)
      try {
        await deleteDoc(doc(db, 'moduleGroupAccess', accessDocId))
      } catch {
        const localGroupAccess = readLocal(localGroupAccessKey, [])
        writeLocal(localGroupAccessKey, localGroupAccess.filter(
          (row) => !(row.classId === classId && row.moduleId === moduleItem.id),
        ))
      }

      // 4. Update local state
      setModulesByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).filter((row) => row.id !== moduleItem.id),
      }))
      setModuleGroupAccess((prev) => {
        const next = { ...prev }
        delete next[moduleGroupKey(classId, moduleItem.id)]
        return next
      })
      setInsightsByClass((prev) => ({
        ...prev,
        [classId]: prev[classId]
          ? { ...prev[classId], modules: Math.max(0, (prev[classId].modules || 1) - 1) }
          : prev[classId],
      }))
    } catch {
      setErrorMessage('Could not delete module.')
    } finally {
      setDeletingModuleId(null)
    }
  }

  const handleToggleModuleArchive = async ({ classId, moduleItem }) => {
    if (!currentUser || !classId || !moduleItem?.id) return
    const nextStatus = moduleItem.moduleStatus === 'archived' ? 'active' : 'archived'

    setErrorMessage('')
    setInfoMessage('')

    try {
      try {
        if (moduleItem.classModuleDocId && !String(moduleItem.classModuleDocId).startsWith('local-')) {
          await apiFetch(`/class-modules/${moduleItem.classModuleDocId}`, {
            user: currentUser,
            method: 'PUT',
            body: {
              class_id: classId,
              module_id: moduleItem.id,
              module_status: nextStatus,
            },
          })
        } else {
          throw new Error('No remote class module doc available')
        }
      } catch {
        const localLinks = readLocal(localLinksKey, [])
        const idx = localLinks.findIndex((row) => row.classId === classId && row.moduleId === moduleItem.id)
        const patch = {
          moduleStatus: nextStatus,
          updatedAt: Date.now(),
        }
        if (idx >= 0) {
          localLinks[idx] = { ...localLinks[idx], ...patch }
        } else {
          localLinks.unshift({
            id: `local-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            classId,
            className: classes.find((c) => c.id === classId)?.name || null,
            moduleId: moduleItem.id,
            moduleName: moduleItem.name || null,
            moduleStatus: nextStatus,
            teacherUid: currentUser.uid,
            updatedAt: Date.now(),
          })
        }
        writeLocal(localLinksKey, localLinks)
        setInfoMessage('Module status saved locally (cloud permissions blocked).')
      }

      setModulesByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((row) => (
          row.id === moduleItem.id ? { ...row, moduleStatus: nextStatus } : row
        )),
      }))
    } catch {
      setErrorMessage('Could not update module archive status.')
    }
  }

  const handleAddStudentToClass = async (classId) => {
    if (!currentUser || addingStudentForClass) return
    const raw = getStudentDraft(classId).trim().toLowerCase()
    if (!raw) return
    if (!raw.includes('@')) {
      setErrorMessage('Please enter a valid student email.')
      return
    }

    const alreadyExists = (studentsByClass[classId] || []).some((s) => s.studentEmail === raw)
    if (alreadyExists) {
      setErrorMessage('That student email is already in this class.')
      return
    }

    setAddingStudentForClass(classId)
    setErrorMessage('')
    try {
      const idToken = await currentUser.getIdToken()
      const lookupRes = await fetch(apiUrl('/students/lookup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: raw }),
      })
      const lookup = await lookupRes.json().catch(() => ({}))
      if (!lookupRes.ok) {
        throw new Error(lookup?.detail || 'Could not verify that student account.')
      }
      if (!lookup.exists) {
        setErrorMessage('No student account exists for that email. Ask the student to create an account first.')
        return
      }
      if (!lookup.is_student || !lookup.uid) {
        setErrorMessage(lookup.message || 'That email belongs to an account, but not a student account.')
        return
      }

      try {
        await apiFetch(`/classes/${classId}/students`, {
          user: currentUser,
          method: 'POST',
          body: { student_email: raw },
        })
      } catch {
        const localStudents = readLocal(localStudentsKey, [])
        localStudents.unshift({
          id: `local-student-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          classId,
          className: classes.find((c) => c.id === classId)?.name || null,
          teacherUid: currentUser.uid,
          teacherName: currentUser.displayName || currentUser.email || null,
          studentEmail: lookup.email || raw,
          studentUid: lookup.uid,
          studentName: lookup.display_name || null,
          status: 'active',
          createdAt: Date.now(),
        })
        writeLocal(localStudentsKey, localStudents)
        setInfoMessage('Student roster update saved locally (cloud permissions blocked).')
      }

      updateStudentDraft(classId, '')
      await refreshData()
    } catch (err) {
      setErrorMessage(err.message || 'Could not add student. Please try again.')
    } finally {
      setAddingStudentForClass(null)
    }
  }

  const handleCreateGroup = async (classId) => {
    if (!currentUser || creatingGroupForClass) return
    const name = getGroupDraft(classId).trim()
    if (!name) return
    const existing = (groupsByClass[classId] || []).some((groupItem) => groupItem.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setErrorMessage('A group with that name already exists in this class.')
      return
    }

    setCreatingGroupForClass(classId)
    setErrorMessage('')
    try {
      try {
        await apiFetch(`/classes/${classId}/groups`, {
          user: currentUser,
          method: 'POST',
          body: { name },
        })
      } catch {
        const localGroups = readLocal(localGroupsKey, [])
        localGroups.unshift({
          id: `local-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          classId,
          className: classes.find((c) => c.id === classId)?.name || null,
          teacherUid: currentUser.uid,
          name,
          members: [],
          createdAt: Date.now(),
        })
        writeLocal(localGroupsKey, localGroups)
        setInfoMessage('Group saved locally (cloud permissions blocked).')
      }

      updateGroupDraft(classId, '')
      await refreshData()
    } finally {
      setCreatingGroupForClass(null)
    }
  }

  const handleRemoveStudent = async ({ classId, studentItem }) => {
    if (!currentUser || !studentItem?.studentEmail) return
    if (!window.confirm(`Remove ${studentItem.studentEmail} from this class? They will also be removed from all groups.`)) return

    setDeletingStudentEmail(studentItem.studentEmail)
    setErrorMessage('')
    try {
      // 1. Delete from classStudents
      try {
        if (studentItem.id && !String(studentItem.id).startsWith('local-')) {
          await deleteDoc(doc(db, 'classStudents', studentItem.id))
        } else {
          throw new Error('Local student')
        }
      } catch {
        const localStudents = readLocal(localStudentsKey, [])
        writeLocal(localStudentsKey, localStudents.filter(
          (row) => !(row.studentEmail === studentItem.studentEmail && row.classId === classId),
        ))
      }

      // 2. Remove from all groups in this class
      const classGroupList = groupsByClass[classId] || []
      await Promise.all(
        classGroupList
          .filter((g) => (g.members || []).includes(studentItem.studentEmail))
          .map(async (g) => {
            const nextMembers = g.members.filter((e) => e !== studentItem.studentEmail)
            try {
              if (!String(g.id).startsWith('local-')) {
                await setDoc(doc(db, 'classGroups', g.id), { members: nextMembers, updatedAt: serverTimestamp() }, { merge: true })
              } else {
                throw new Error('Local group')
              }
            } catch {
              const localGroups = readLocal(localGroupsKey, [])
              const idx = localGroups.findIndex((row) => row.id === g.id)
              if (idx >= 0) {
                localGroups[idx] = { ...localGroups[idx], members: nextMembers }
                writeLocal(localGroupsKey, localGroups)
              }
            }
          }),
      )

      // 3. Update local state
      setStudentsByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).filter((s) => s.studentEmail !== studentItem.studentEmail),
      }))
      setGroupsByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((g) => ({
          ...g,
          members: (g.members || []).filter((e) => e !== studentItem.studentEmail),
        })),
      }))
      setInsightsByClass((prev) => ({
        ...prev,
        [classId]: prev[classId]
          ? { ...prev[classId], activeStudents: Math.max(0, (prev[classId].activeStudents || 1) - 1) }
          : prev[classId],
      }))
    } catch {
      setErrorMessage('Could not remove student.')
    } finally {
      setDeletingStudentEmail(null)
    }
  }

  const handleDeleteGroup = async ({ classId, groupItem }) => {
    if (!currentUser || !groupItem?.id) return
    if (!window.confirm(`Delete group "${groupItem.name}"? It will be unassigned from all modules.`)) return

    setDeletingGroupId(groupItem.id)
    setErrorMessage('')
    try {
      // 1. Delete from classGroups
      try {
        if (!String(groupItem.id).startsWith('local-')) {
          await deleteDoc(doc(db, 'classGroups', groupItem.id))
        } else {
          throw new Error('Local group')
        }
      } catch {
        const localGroups = readLocal(localGroupsKey, [])
        writeLocal(localGroupsKey, localGroups.filter((row) => row.id !== groupItem.id))
      }

      // 2. Remove this groupId from moduleGroupAccess for all modules in this class
      const classModuleList = modulesByClass[classId] || []
      await Promise.all(
        classModuleList.map(async (moduleItem) => {
          const key = moduleGroupKey(classId, moduleItem.id)
          const currentGroupIds = moduleGroupAccess[key] || []
          if (!currentGroupIds.includes(groupItem.id)) return
          const nextGroupIds = currentGroupIds.filter((id) => id !== groupItem.id)
          const accessDocId = `${classId}_${moduleItem.id}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 120)
          try {
            await setDoc(doc(db, 'moduleGroupAccess', accessDocId), {
              groupIds: nextGroupIds,
              updatedAt: serverTimestamp(),
            }, { merge: true })
          } catch {
            const localGroupAccess = readLocal(localGroupAccessKey, [])
            const idx = localGroupAccess.findIndex((row) => row.classId === classId && row.moduleId === moduleItem.id)
            if (idx >= 0) {
              localGroupAccess[idx] = { ...localGroupAccess[idx], groupIds: nextGroupIds }
              writeLocal(localGroupAccessKey, localGroupAccess)
            }
          }
        }),
      )

      // 3. Update local state
      setGroupsByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).filter((g) => g.id !== groupItem.id),
      }))
      setModuleGroupAccess((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${classId}::`)) {
            next[key] = (next[key] || []).filter((id) => id !== groupItem.id)
          }
        })
        return next
      })
    } catch {
      setErrorMessage('Could not delete group.')
    } finally {
      setDeletingGroupId(null)
    }
  }

  const handleToggleStudentInGroup = async ({ classId, groupItem, studentEmail }) => {
    if (!currentUser || !groupItem?.id || !studentEmail) return
    const currentMembers = Array.isArray(groupItem.members) ? groupItem.members : []
    const hasStudent = currentMembers.includes(studentEmail)
    const nextMembers = hasStudent
      ? currentMembers.filter((email) => email !== studentEmail)
      : [...currentMembers, studentEmail]

    try {
      try {
        await apiFetch(`/groups/${groupItem.id}/members`, {
          user: currentUser,
          method: 'PUT',
          body: { members: nextMembers },
        })
      } catch {
        const localGroups = readLocal(localGroupsKey, [])
        const idx = localGroups.findIndex((row) => row.id === groupItem.id)
        if (idx >= 0) {
          localGroups[idx] = { ...localGroups[idx], members: nextMembers, updatedAt: null }
        } else {
          localGroups.unshift({
            id: groupItem.id,
            classId,
            className: classes.find((c) => c.id === classId)?.name || null,
            teacherUid: currentUser.uid,
            name: groupItem.name,
            members: nextMembers,
            updatedAt: null,
          })
        }
        writeLocal(localGroupsKey, localGroups)
        setInfoMessage('Group membership saved locally (cloud permissions blocked).')
      }

      setGroupsByClass((prev) => ({
        ...prev,
        [classId]: (prev[classId] || []).map((row) => (row.id === groupItem.id ? { ...row, members: nextMembers } : row)),
      }))
    } catch {
      setErrorMessage('Could not update group membership.')
    }
  }

  const handleToggleGroupForModule = async ({ classId, moduleItem, groupId }) => {
    if (!currentUser || !moduleItem?.id || !groupId) return

    const key = moduleGroupKey(classId, moduleItem.id)
    const assigned = moduleGroupAccess[key] || []
    const nextGroupIds = assigned.includes(groupId)
      ? assigned.filter((id) => id !== groupId)
      : [...assigned, groupId]
    const classGroups = groupsByClass[classId] || []
    const classStudents = studentsByClass[classId] || []
    const allowedEmails = new Set(
      classGroups
        .filter((groupItem) => nextGroupIds.includes(groupItem.id))
        .flatMap((groupItem) => Array.isArray(groupItem.members) ? groupItem.members : [])
        .filter(Boolean),
    )
    const allClassEmails = [...new Set(classStudents.map((row) => row.studentEmail).filter(Boolean))]
    const groupManagedEmails = allClassEmails.filter((email) => {
      const keyForStudent = moduleStudentKey(classId, moduleItem.id, email)
      return moduleAccessByKey[keyForStudent]?.source !== 'manual'
    })

    try {
      try {
        await apiFetch('/module-group-access', {
          user: currentUser,
          method: 'POST',
          body: {
            class_id: classId,
            module_id: moduleItem.id,
            group_ids: nextGroupIds,
          },
        })

        await Promise.all(
          groupManagedEmails.map((email) => apiFetch('/module-access', {
            user: currentUser,
            method: 'POST',
            body: {
              class_id: classId,
              module_id: moduleItem.id,
              student_email: email,
              is_unlocked: allowedEmails.has(email),
              source: 'group',
            },
          })),
        )
      } catch {
        const localGroupAccess = readLocal(localGroupAccessKey, [])
        const idx = localGroupAccess.findIndex((row) => row.classId === classId && row.moduleId === moduleItem.id)
        const payload = {
          classId,
          className: classes.find((c) => c.id === classId)?.name || null,
          moduleId: moduleItem.id,
          moduleName: moduleItem.name || null,
          teacherUid: currentUser.uid,
          groupIds: nextGroupIds,
          updatedAt: null,
        }
        if (idx >= 0) localGroupAccess[idx] = { ...localGroupAccess[idx], ...payload }
        else localGroupAccess.unshift(payload)
        writeLocal(localGroupAccessKey, localGroupAccess)

        const localAccess = readLocal(localAccessKey, [])
        groupManagedEmails.forEach((email) => {
          const existingIdx = localAccess.findIndex((row) => row.classId === classId && row.moduleId === moduleItem.id && row.studentEmail === email)
          const nextRow = {
            classId,
            className: classes.find((c) => c.id === classId)?.name || null,
            moduleId: moduleItem.id,
            moduleName: moduleItem.name || null,
            teacherUid: currentUser.uid,
            studentEmail: email,
            isUnlocked: allowedEmails.has(email),
            source: 'group',
            updatedAt: Date.now(),
          }
          if (existingIdx >= 0) localAccess[existingIdx] = { ...localAccess[existingIdx], ...nextRow }
          else localAccess.unshift(nextRow)
        })
        writeLocal(localAccessKey, localAccess)
        setInfoMessage('Group module access saved locally (cloud permissions blocked).')
      }

      setModuleGroupAccess((prev) => ({ ...prev, [key]: nextGroupIds }))
      setModuleAccessByKey((prev) => {
        const next = { ...prev }
        groupManagedEmails.forEach((email) => {
          const studentKey = moduleStudentKey(classId, moduleItem.id, email)
          next[studentKey] = {
            isUnlocked: allowedEmails.has(email),
            source: 'group',
          }
        })
        return next
      })
    } catch {
      setErrorMessage('Could not update module access for selected groups.')
    }
  }

  const handleToggleIndividualModuleAccess = async ({ classId, moduleItem, studentEmail }) => {
    if (!currentUser || !classId || !moduleItem?.id || !studentEmail) return

    const classGroups = groupsByClass[classId] || []
    const assignedGroups = moduleGroupAccess[moduleGroupKey(classId, moduleItem.id)] || []
    const groupDerivedUnlocked = classGroups
      .filter((groupItem) => assignedGroups.includes(groupItem.id))
      .some((groupItem) => (groupItem.members || []).includes(studentEmail))

    const key = moduleStudentKey(classId, moduleItem.id, studentEmail)
    const existing = moduleAccessByKey[key]
    const currentUnlocked = existing?.source === 'manual' ? Boolean(existing.isUnlocked) : groupDerivedUnlocked
    const nextUnlocked = !currentUnlocked

    try {
      try {
        await apiFetch('/module-access', {
          user: currentUser,
          method: 'POST',
          body: {
            class_id: classId,
            module_id: moduleItem.id,
            student_email: studentEmail,
            is_unlocked: nextUnlocked,
            source: 'manual',
          },
        })
      } catch {
        const localAccess = readLocal(localAccessKey, [])
        const idx = localAccess.findIndex((row) => row.classId === classId && row.moduleId === moduleItem.id && row.studentEmail === studentEmail)
        const payload = {
          classId,
          className: classes.find((c) => c.id === classId)?.name || null,
          moduleId: moduleItem.id,
          moduleName: moduleItem.name || null,
          teacherUid: currentUser.uid,
          studentEmail,
          isUnlocked: nextUnlocked,
          source: 'manual',
          updatedAt: null,
        }
        if (idx >= 0) localAccess[idx] = { ...localAccess[idx], ...payload }
        else localAccess.unshift(payload)
        writeLocal(localAccessKey, localAccess)
        setInfoMessage('Individual module access saved locally (cloud permissions blocked).')
      }

      setModuleAccessByKey((prev) => ({
        ...prev,
        [key]: { isUnlocked: nextUnlocked, source: 'manual' },
      }))
    } catch {
      setErrorMessage('Could not update individual module access.')
    }
  }

  const formatLatestActivity = (tsMillis) => {
    if (!tsMillis) return 'No student activity yet'
    return `Last activity ${new Date(tsMillis).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
  }

  const filteredClasses = classes.filter((classItem) => {
    const status = classItem.status || 'active'
    if (classStatusFilter === 'all') return true
    return status === classStatusFilter
  })

  const renderClassActions = (classItem, { compact = false } = {}) => (
    <div
      className={[
        'flex items-center gap-1.5',
        compact ? 'flex-wrap' : 'flex-shrink-0',
      ].join(' ')}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={archivingClassId === classItem.id || deletingClassId === classItem.id}
        onClick={() => handleToggleClassArchive(classItem)}
      >
        {archivingClassId === classItem.id
          ? 'Updating...'
          : (classItem.status || 'active') === 'archived'
            ? 'Restore'
            : 'Archive'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={deletingClassId === classItem.id || archivingClassId === classItem.id}
        onClick={() => handleDeleteClass(classItem)}
      >
        {deletingClassId === classItem.id ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  )

  return (
    <Panel className="p-5 md:p-6 tp-card-surface border-[var(--color-border-card-subtle)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Class Management</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Create classes, organize rosters, assign groups, and review class-level insights.
          </p>
        </div>
        {!showCreateClassForm && (
          <Button onClick={() => setShowCreateClassForm(true)} variant="primary" size="md">
            + Create New Class
          </Button>
        )}
      </div>

      {showCreateClassForm && (
        <form onSubmit={handleCreateClass} className="mb-6 rounded-xl border border-[var(--color-border-card-subtle)] bg-white/80 p-4">
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
        <div className="mb-4 rounded-lg border border-[var(--color-danger-500)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-600)]">
          {errorMessage}
        </div>
      )}
      {!!infoMessage && (
        <div className="mb-4 rounded-lg border border-[var(--color-border-card)] bg-[var(--bg-frosted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
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
        <>
          {!selectedClassId ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {filteredClasses.length} {classStatusFilter === 'all' ? '' : `${classStatusFilter} `}class{filteredClasses.length === 1 ? '' : 'es'}
                </p>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  Show
                  <select
                    value={classStatusFilter}
                    onChange={(e) => setClassStatusFilter(e.target.value)}
                    className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/80 px-2.5 py-1.5 text-sm text-[var(--color-text-primary)]"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>
              {filteredClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgba(65,90,119,0.3)] bg-white/55 p-6 text-sm text-[var(--color-text-secondary)]">
                  {classStatusFilter === 'archived'
                    ? 'No archived classes. Archive a class to hide it from your active list.'
                    : 'No classes match this filter.'}
                </div>
              ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClasses.map((classItem) => {
                const insight = insightsByClass[classItem.id] || { modules: 0, activeStudents: 0, totalPrompts: 0 }
                const isArchived = (classItem.status || 'active') === 'archived'
                return (
                  <Card
                    key={classItem.id}
                    interactive={!isArchived}
                    onClick={() => !isArchived && setSelectedClassId(classItem.id)}
                    className={[
                      'p-5 border-[var(--color-border-card-subtle)] tp-card-surface transition-all',
                      isArchived ? 'opacity-80' : 'cursor-pointer hover:-translate-y-0.5',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{classItem.name}</h4>
                        {classItem.description && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{classItem.description}</p>
                        )}
                      </div>
                      <Badge tone={isArchived ? 'warning' : 'brand'}>
                        {isArchived ? 'Archived' : 'Class'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 mt-4">
                      <div className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft px-3 py-2.5">
                        <p className="text-[0.58rem] leading-none font-semibold uppercase tracking-[0.1em] whitespace-nowrap text-[var(--color-text-muted)]">Modules</p>
                        <p className="text-[1.35rem] leading-none font-semibold text-[var(--color-text-primary)] mt-1">{insight.modules}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft px-3 py-2.5">
                        <p className="text-[0.58rem] leading-none font-semibold uppercase tracking-[0.1em] whitespace-nowrap text-[var(--color-text-muted)]">Students</p>
                        <p className="text-[1.35rem] leading-none font-semibold text-[var(--color-text-primary)] mt-1">{insight.activeStudents}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft px-3 py-2.5">
                        <p className="text-[0.58rem] leading-none font-semibold uppercase tracking-[0.1em] whitespace-nowrap text-[var(--color-text-muted)]">Insights</p>
                        <p className="text-[1.35rem] leading-none font-semibold text-[var(--color-text-primary)] mt-1">{insight.totalPrompts}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {!isArchived ? (
                        <p className="text-sm font-semibold text-[var(--color-brand-600)]">Open Course →</p>
                      ) : (
                        <p className="text-sm text-[var(--color-text-muted)]">Restore to reopen this class.</p>
                      )}
                      {renderClassActions(classItem, { compact: true })}
                    </div>
                  </Card>
                )
              })}
            </div>
              )}
            </>
          ) : (
            (() => {
              const classItem = classes.find((c) => c.id === selectedClassId)
              if (!classItem) return null
              const classModules = modulesByClass[classItem.id] || []
              const filteredModules = classModules.filter((moduleItem) => {
                const status = moduleItem.moduleStatus || 'active'
                if (moduleStatusFilter !== 'all' && status !== moduleStatusFilter) return false
                if (moduleSearchTerm.trim()) {
                  const needle = moduleSearchTerm.trim().toLowerCase()
                  const haystack = [
                    moduleItem.name,
                    moduleItem.description,
                  ].join(' ').toLowerCase()
                  if (!haystack.includes(needle)) return false
                }
                return true
              })
              const insight = insightsByClass[classItem.id] || { modules: 0, activeStudents: 0, totalPrompts: 0, latestTs: 0 }
              const draft = getModuleDraft(classItem.id)
              const classStudents = studentsByClass[classItem.id] || []
              const studentDraft = getStudentDraft(classItem.id)
              const classGroups = groupsByClass[classItem.id] || []
              const groupDraft = getGroupDraft(classItem.id)

              return (
                <div className="space-y-4">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedClassId(null)}>
                    ← Back To All Courses
                  </Button>
                  <Card className="p-5 border-[var(--color-border-card-subtle)] tp-card-surface">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{classItem.name}</h4>
                        {classItem.description && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{classItem.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge tone={(classItem.status || 'active') === 'archived' ? 'warning' : 'brand'}>
                          {(classItem.status || 'active') === 'archived' ? 'Archived' : 'Class'}
                        </Badge>
                        {renderClassActions(classItem)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 px-3 py-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Modules</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.modules}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 px-3 py-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Active Students</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.activeStudents}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 px-3 py-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Insights</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">{insight.totalPrompts}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--color-text-muted)] mt-3">{formatLatestActivity(insight.latestTs)}</p>
                    <div className="mt-4 rounded-xl border border-[var(--color-border-card)] bg-[rgba(255,255,255,0.46)] p-2 grid grid-cols-3 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={classDetailTab === 'roster' ? 'primary' : 'secondary'}
                        className="w-full"
                        onClick={() => setClassDetailTab('roster')}
                      >
                        Roster
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={classDetailTab === 'groups' ? 'primary' : 'secondary'}
                        className="w-full"
                        onClick={() => setClassDetailTab('groups')}
                      >
                        Groups
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={classDetailTab === 'modules' ? 'primary' : 'secondary'}
                        className="w-full"
                        onClick={() => setClassDetailTab('modules')}
                      >
                        Modules
                      </Button>
                    </div>

                    {classDetailTab === 'roster' && (
                      <div className="mt-4 rounded-xl border border-[var(--color-border-card-subtle)] bg-white/65 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Class Roster</p>
                          <Badge tone="neutral">{classStudents.length} enrolled</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Add students once here, then assign module access through groups.
                        </p>

                        <div className="mt-2 flex gap-2">
                          <Input
                            value={studentDraft}
                            onChange={(e) => updateStudentDraft(classItem.id, e.target.value)}
                            placeholder="student@email.com"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!studentDraft.trim() || addingStudentForClass === classItem.id}
                            onClick={() => handleAddStudentToClass(classItem.id)}
                          >
                            {addingStudentForClass === classItem.id ? 'Adding...' : 'Add Student'}
                          </Button>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {classStudents.length === 0 ? (
                            <span className="text-xs text-[var(--color-text-muted)]">No students yet.</span>
                          ) : (
                            classStudents.map((s) => (
                              <div key={`${classItem.id}-${s.studentEmail}`} className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/80 px-2.5 py-2 text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-2">
                                <span>{s.studentEmail}</span>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={deletingStudentEmail === s.studentEmail}
                                  onClick={() => handleRemoveStudent({ classId: classItem.id, studentItem: s })}
                                >
                                  {deletingStudentEmail === s.studentEmail ? 'Removing...' : 'Remove'}
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {classDetailTab === 'groups' && (
                      <div className="mt-4 rounded-xl border border-[var(--color-border-card-subtle)] bg-white/65 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Student Groups</p>
                          <Badge tone="neutral">{classGroups.length} groups</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Build reusable groups once, then assign groups to modules in one click.
                        </p>

                        <div className="mt-2 flex gap-2">
                          <Input
                            value={groupDraft}
                            onChange={(e) => updateGroupDraft(classItem.id, e.target.value)}
                            placeholder="Group name (e.g. Period 1, Intervention)"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!groupDraft.trim() || creatingGroupForClass === classItem.id}
                            onClick={() => handleCreateGroup(classItem.id)}
                          >
                            {creatingGroupForClass === classItem.id ? 'Creating...' : 'Create Group'}
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {classGroups.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                              No groups yet. Create one, then add students to it.
                            </div>
                          ) : (
                            classGroups.map((groupItem) => (
                              <div key={groupItem.id} className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/75 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  {editingGroupNameId === groupItem.id ? (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <Input
                                        value={editingGroupNameValue}
                                        onChange={(e) => setEditingGroupNameValue(e.target.value)}
                                        placeholder="Group name"
                                        className="text-sm"
                                      />
                                      <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        disabled={!editingGroupNameValue.trim() || savingGroupNameId === groupItem.id}
                                        onClick={() => handleSaveGroupName({ classId: classItem.id, groupItem })}
                                      >
                                        {savingGroupNameId === groupItem.id ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={savingGroupNameId === groupItem.id}
                                        onClick={handleCancelEditGroupName}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{groupItem.name}</p>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleStartEditGroupName(groupItem)}
                                      >
                                        Rename
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={deletingGroupId === groupItem.id}
                                        onClick={() => handleDeleteGroup({ classId: classItem.id, groupItem })}
                                      >
                                        {deletingGroupId === groupItem.id ? 'Deleting...' : 'Delete'}
                                      </Button>
                                    </div>
                                  )}
                                  <Badge tone="brand" className="shrink-0">{(groupItem.members || []).length} students</Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {classStudents.length === 0 ? (
                                    <span className="text-xs text-[var(--color-text-muted)]">Add students to roster first.</span>
                                  ) : (
                                    classStudents.map((studentRow) => {
                                      const email = studentRow.studentEmail
                                      const inGroup = (groupItem.members || []).includes(email)
                                      return (
                                        <Button
                                          key={`${groupItem.id}-${email}`}
                                          type="button"
                                          size="sm"
                                          variant={inGroup ? 'primary' : 'secondary'}
                                          className="text-[0.74rem] px-2.5 py-1"
                                          onClick={() => handleToggleStudentInGroup({ classId: classItem.id, groupItem, studentEmail: email })}
                                        >
                                          {inGroup ? `In Group: ${email}` : `Add: ${email}`}
                                        </Button>
                                      )
                                    })
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {classDetailTab === 'modules' && (
                      <>
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

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2">
                          <Input
                            value={moduleSearchTerm}
                            onChange={(e) => setModuleSearchTerm(e.target.value)}
                            placeholder="Search modules..."
                          />
                          <select
                            value={moduleStatusFilter}
                            onChange={(e) => setModuleStatusFilter(e.target.value)}
                            className="tp-input"
                          >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>

                        {draft.open && (
                          <div className="mt-3 rounded-xl border border-[var(--color-border-card)] bg-white/80 p-3">
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
                          ) : filteredModules.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                              No modules match this filter.
                            </div>
                          ) : (
                            filteredModules.map((moduleItem) => {
                              const assignedGroups = moduleGroupAccess[moduleGroupKey(classItem.id, moduleItem.id)] || []
                              const allowedEmails = new Set(
                                classGroups
                                  .filter((groupItem) => assignedGroups.includes(groupItem.id))
                                  .flatMap((groupItem) => Array.isArray(groupItem.members) ? groupItem.members : [])
                                  .filter(Boolean),
                              )

                              return (
                                <div key={moduleItem.id} className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      {editingModuleNameId === moduleItem.id ? (
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Input
                                            value={editingModuleNameValue}
                                            onChange={(e) => setEditingModuleNameValue(e.target.value)}
                                            placeholder="Module name"
                                            className="text-sm"
                                          />
                                          <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            disabled={!editingModuleNameValue.trim() || savingModuleNameId === moduleItem.id}
                                            onClick={() => handleSaveModuleName({ classId: classItem.id, moduleItem })}
                                          >
                                            {savingModuleNameId === moduleItem.id ? 'Saving...' : 'Save'}
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={savingModuleNameId === moduleItem.id}
                                            onClick={handleCancelEditModuleName}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      ) : (
                                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{moduleItem.name}</p>
                                      )}
                                      {editingModuleDescriptionId === moduleItem.id ? (
                                        <div className="mt-1.5 flex flex-col gap-2">
                                          <Input
                                            value={editingModuleDescriptionValue}
                                            onChange={(e) => setEditingModuleDescriptionValue(e.target.value)}
                                            placeholder="Module description (optional)"
                                            className="text-xs"
                                          />
                                          <div className="flex gap-1.5">
                                            <Button
                                              type="button"
                                              variant="primary"
                                              size="sm"
                                              disabled={savingModuleDescriptionId === moduleItem.id}
                                              onClick={() => handleSaveModuleDescription({
                                                classId: classItem.id,
                                                moduleItem,
                                              })}
                                            >
                                              {savingModuleDescriptionId === moduleItem.id ? 'Saving...' : 'Save'}
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              disabled={savingModuleDescriptionId === moduleItem.id}
                                              onClick={handleCancelEditModuleDescription}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : moduleItem.description ? (
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{moduleItem.description}</p>
                                      ) : (
                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 italic">No description yet.</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Badge tone={moduleItem.moduleStatus === 'archived' ? 'warning' : 'neutral'}>
                                        {moduleItem.moduleStatus === 'archived' ? 'Archived' : 'Module'}
                                      </Badge>
                                      {editingModuleDescriptionId !== moduleItem.id && editingModuleNameId !== moduleItem.id && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => handleStartEditModuleName(moduleItem)}
                                        >
                                          Rename
                                        </Button>
                                      )}
                                      {editingModuleDescriptionId !== moduleItem.id && editingModuleNameId !== moduleItem.id && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => handleStartEditModuleDescription(moduleItem)}
                                        >
                                          Edit Description
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleToggleModuleArchive({
                                          classId: classItem.id,
                                          moduleItem,
                                        })}
                                      >
                                        {moduleItem.moduleStatus === 'archived' ? 'Restore' : 'Archive'}
                                      </Button>
                                      {editingModuleDescriptionId !== moduleItem.id && editingModuleNameId !== moduleItem.id && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          disabled={deletingModuleId === moduleItem.id}
                                          onClick={() => handleDeleteModule({ classId: classItem.id, moduleItem })}
                                        >
                                          {deletingModuleId === moduleItem.id ? 'Deleting...' : 'Delete'}
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-2.5 flex items-center justify-between gap-2">
                                    <Badge tone="neutral">
                                      {allowedEmails.size} unlocked
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={async () => {
                                        const next = !openDocumentsByModule[moduleItem.id]
                                        setOpenDocumentsByModule((prev) => ({ ...prev, [moduleItem.id]: next }))
                                        if (next) await fetchDocumentsForModule(moduleItem.id)
                                      }}
                                    >
                                      {openDocumentsByModule[moduleItem.id] ? 'Hide documents' : 'Documents'}
                                    </Button>
                                  </div>

                                  {openDocumentsByModule[moduleItem.id] && (
                                    <div className="mt-3 rounded-lg border border-[var(--color-border-card-subtle)] bg-white/80">
                                      <DocumentPanel
                                        moduleId={moduleItem.id}
                                        documents={documentsByModule[moduleItem.id] || []}
                                        onDocumentsChanged={() => fetchDocumentsForModule(moduleItem.id)}
                                      />
                                    </div>
                                  )}

                                  <div className="mt-2.5">
                                    <p className="tp-eyebrow mb-1.5">
                                      Assign Groups
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {classGroups.length === 0 ? (
                                        <span className="text-xs text-[var(--color-text-muted)]">Create groups first in the Groups tab.</span>
                                      ) : (
                                        classGroups.map((groupItem) => {
                                          const selected = assignedGroups.includes(groupItem.id)
                                          return (
                                            <Button
                                              key={`${moduleItem.id}-${groupItem.id}`}
                                              type="button"
                                              variant={selected ? 'primary' : 'secondary'}
                                              size="sm"
                                              className="text-[0.74rem] px-2.5 py-1"
                                              onClick={() => handleToggleGroupForModule({
                                                classId: classItem.id,
                                                moduleItem,
                                                groupId: groupItem.id,
                                              })}
                                            >
                                              {selected ? `Assigned: ${groupItem.name}` : `Assign: ${groupItem.name}`}
                                            </Button>
                                          )
                                        })
                                      )}
                                    </div>
                                  </div>

                                  {classStudents.length > 0 && (
                                    <div className="mt-3 rounded-lg border border-[var(--color-border-card-subtle)] bg-[var(--color-bg-muted)] p-2.5">
                                      <p className="tp-eyebrow mb-1.5">
                                        Individual Overrides
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {classStudents.map((studentRow) => {
                                          const email = studentRow.studentEmail
                                          const key = moduleStudentKey(classItem.id, moduleItem.id, email)
                                          const access = moduleAccessByKey[key]
                                          const groupDerivedUnlocked = classGroups
                                            .filter((groupItem) => assignedGroups.includes(groupItem.id))
                                            .some((groupItem) => (groupItem.members || []).includes(email))
                                          const unlocked = access?.source === 'manual'
                                            ? Boolean(access?.isUnlocked)
                                            : groupDerivedUnlocked
                                          const prefix = access?.source === 'manual' ? 'Manual' : 'Group'
                                          return (
                                            <Button
                                              key={`${moduleItem.id}-manual-${email}`}
                                              type="button"
                                              size="sm"
                                              variant={unlocked ? 'primary' : 'secondary'}
                                              className="text-[0.74rem] px-2.5 py-1"
                                              onClick={() => handleToggleIndividualModuleAccess({
                                                classId: classItem.id,
                                                moduleItem,
                                                studentEmail: email,
                                              })}
                                            >
                                              {`${prefix}: ${email}`}
                                            </Button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              )
            })()
          )}
        </>
      )}
    </Panel>
  )
}

export default function TeacherDashboard({ onLogout, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [classesWarmupKey, setClassesWarmupKey] = useState(0)
  const [overviewStats, setOverviewStats] = useState({
    activeStudents: '--',
    modules: '--',
    classes: '--',
    insights: '0',
  })
  const firstName = currentUser?.displayName?.split(' ')[0] || null

  const classesPanel = useMemo(() => (
    <ClassManagementPanel key={classesWarmupKey} currentUser={currentUser} />
  ), [classesWarmupKey, currentUser])

  useEffect(() => {
    const loadOverviewStats = async () => {
      if (!currentUser?.uid) return

      try {
        const uid = encodeURIComponent(currentUser.uid)
        const [moduleRes, classRows, studentRows, classModuleRows] = await Promise.all([
          fetch(apiUrl(`/modules?teacher_uid=${uid}`)),
          apiFetch('/classes', { user: currentUser }),
          apiFetch(`/class-students?teacher_uid=${uid}`, { user: currentUser }),
          apiFetch(`/class-modules?teacher_uid=${uid}`, { user: currentUser }),
        ])

        const moduleData = await moduleRes.json()
        const knownModules = Array.isArray(moduleData) ? moduleData : []
        const knownModuleIds = new Set(knownModules.map((m) => m.id).filter(Boolean))
        const linkedModuleIds = new Set(
          (Array.isArray(classModuleRows) ? classModuleRows : [])
            .map((row) => row.moduleId)
            .filter((moduleId) => moduleId && (!knownModuleIds.size || knownModuleIds.has(moduleId))),
        )
        const modulesCount = linkedModuleIds.size
        const classesCount = Array.isArray(classRows) ? classRows.length : 0
        const uniqueStudents = new Set(
          (Array.isArray(studentRows) ? studentRows : [])
            .map((row) => row.studentUid || row.studentEmail)
            .filter(Boolean),
        ).size
        const insightsCount = 0

        setOverviewStats({
          activeStudents: String(uniqueStudents),
          modules: String(modulesCount),
          classes: String(classesCount),
          insights: String(insightsCount),
        })
      } catch {
        setOverviewStats({
          activeStudents: '--',
          modules: '--',
          classes: '--',
          insights: '0',
        })
      }
    }

    loadOverviewStats()
  }, [currentUser?.uid, activeTab])

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[var(--color-bg-canvas)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(65,90,119,0.34),rgba(65,90,119,0)_54%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(27,38,59,0.14),rgba(27,38,59,0.02)_42%,rgba(65,90,119,0.2)_100%)]" />

      <header className="relative z-10 border-b border-[var(--color-border-card-subtle)] tp-header-surface backdrop-blur-md">
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
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <Button onClick={onLogout} variant="secondary" size="md">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1240px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
          <aside className="lg:sticky lg:top-24 h-fit">
            <Panel className="p-5 tp-card-surface border-[var(--color-border-card-subtle)] shadow-[var(--shadow-sm)] backdrop-blur-sm">
              <p className="tp-eyebrow mb-2">Workspace</p>
              <h2 className="text-[2rem] font-semibold leading-[1.08] text-[var(--color-text-primary)]">
                Welcome back{firstName ? `, ${firstName}` : ''}.
              </h2>
              <p className="text-[1.05rem] leading-relaxed text-[var(--color-text-secondary)] mt-4">
                Monitor engagement, review student activity, and manage your class content in one place.
              </p>

              <div className="mt-5 rounded-[1.75rem] border border-[var(--color-border-card-subtle)] bg-[var(--color-bg-muted)] p-2 flex flex-col gap-1.5">
                <Button
                  onClick={() => setActiveTab('overview')}
                  variant="ghost"
                  size="md"
                  className={activeTab === 'overview' ? 'tp-nav-btn-active border justify-start' : 'tp-nav-btn border justify-start'}
                >
                  Overview
                </Button>
                <Button
                  onClick={() => setActiveTab('analytics')}
                  variant="ghost"
                  size="md"
                  className={activeTab === 'analytics' ? 'tp-nav-btn-active border justify-start' : 'tp-nav-btn border justify-start'}
                >
                  Analytics
                </Button>
                <Button
                  onClick={() => setActiveTab('classes')}
                  variant="ghost"
                  size="md"
                  className={activeTab === 'classes' ? 'tp-nav-btn-active border justify-start' : 'tp-nav-btn border justify-start'}
                >
                  Class Management
                </Button>
              </div>
            </Panel>
          </aside>

          <section className="space-y-6">
            {activeTab === 'analytics' ? (
              <Panel className="p-5 md:p-6 tp-card-surface border-[var(--color-border-card-subtle)] backdrop-blur-sm">
                <AnalyticsDashboard />
              </Panel>
            ) : activeTab === 'classes' ? (
              classesPanel
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Active Students" value={overviewStats.activeStudents} tone="blue" />
                  <StatCard label="Modules" value={overviewStats.modules} tone="purple" />
                  <StatCard label="Classes" value={overviewStats.classes} tone="amber" />
                  <StatCard label="Insights" value={overviewStats.insights} tone="green" />
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
                    cta="Open class management"
                    onClick={() => {
                      // Route teachers to the module list, where per-module document upload lives.
                      setActiveTab('classes')
                      // Force remount to ensure fresh data load when navigating from Overview.
                      setClassesWarmupKey((v) => v + 1)
                    }}
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
