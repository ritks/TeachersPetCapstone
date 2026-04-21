import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { Badge, Button, Card, Panel } from '../ui/primitives'
import LogoMark from '../common/LogoMark'
import { useStudent } from '../../contexts/StudentContext'

function keyFor(classId, moduleId) {
  return `${classId}::${moduleId}`
}

export default function StudentDashboard({ currentUser, onLogout }) {
  const navigate = useNavigate()
  const { registerModule } = useStudent()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classCards, setClassCards] = useState([])

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!currentUser) return
      setLoading(true)
      setError('')
      try {
        const email = (currentUser.email || '').toLowerCase()
        const enrollmentSettled = await Promise.allSettled([
          getDocs(query(collection(db, 'classStudents'), where('studentUid', '==', currentUser.uid))),
          email ? getDocs(query(collection(db, 'classStudents'), where('studentEmail', '==', email))) : Promise.resolve({ docs: [] }),
        ])

        const enrollmentMap = {}
        enrollmentSettled.forEach((result) => {
          if (result.status !== 'fulfilled') return
          result.value.docs.forEach((d) => { enrollmentMap[d.id] = { id: d.id, ...d.data() } })
        })
        const enrollments = Object.values(enrollmentMap)
        const classIds = [...new Set(enrollments.map((e) => e.classId).filter(Boolean))]

        if (classIds.length === 0) {
          setClassCards([])
          setLoading(false)
          return
        }

        const classDocSettled = await Promise.allSettled(
          classIds.map(async (classId) => {
            const snap = await getDoc(doc(db, 'teacherClasses', classId))
            return snap.exists() ? { id: snap.id, ...snap.data() } : { id: classId, name: 'Class', teacherName: null }
          }),
        )
        const classDocs = classDocSettled.map((res, idx) => (
          res.status === 'fulfilled'
            ? res.value
            : {
                id: classIds[idx],
                name: enrollments.find((e) => e.classId === classIds[idx])?.className || 'Class',
                teacherName: enrollments.find((e) => e.classId === classIds[idx])?.teacherName || null,
              }
        ))

        const moduleRowsSettled = await Promise.allSettled(
          classIds.map(async (classId) => {
            const snap = await getDocs(query(collection(db, 'classModules'), where('classId', '==', classId)))
            return {
              classId,
              rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            }
          }),
        )
        const moduleDocsPerClass = moduleRowsSettled.map((res, idx) => (
          res.status === 'fulfilled'
            ? res.value
            : { classId: classIds[idx], rows: [] }
        ))

        const accessSettled = await Promise.allSettled([
          getDocs(query(collection(db, 'moduleAccess'), where('studentUid', '==', currentUser.uid))),
          email ? getDocs(query(collection(db, 'moduleAccess'), where('studentEmail', '==', email))) : Promise.resolve({ docs: [] }),
        ])
        const codesSettled = await Promise.allSettled([
          getDocs(collection(db, 'courseCodes')),
        ])

        const moduleMapByClass = {}
        const classNameByClassId = {}
        moduleDocsPerClass.forEach(({ classId, rows }) => {
          moduleMapByClass[classId] = rows
          rows.forEach((row) => {
            if (row.className && !classNameByClassId[classId]) classNameByClassId[classId] = row.className
          })
        })

        const accessMap = {}
        const accessRows = []
        accessSettled.forEach((result) => {
          if (result.status !== 'fulfilled') return
          result.value.docs.forEach((d) => {
            const data = d.data()
            if (!data.classId || !data.moduleId) return
            accessMap[keyFor(data.classId, data.moduleId)] = Boolean(data.isUnlocked)
            accessRows.push(data)
          })
        })

        const codeRows = codesSettled[0].status === 'fulfilled'
          ? codesSettled[0].value.docs.map((d) => ({ code: d.id, ...d.data() }))
          : []

        const courseCodeByModuleKey = {}
        codeRows.forEach((row) => {
          if (!row.classId || !row.moduleId) return
          if (row.className) classNameByClassId[row.classId] = row.className
          courseCodeByModuleKey[keyFor(row.classId, row.moduleId)] = row.code
        })

        accessRows.forEach((row) => {
          if (row.classId && row.className && !classNameByClassId[row.classId]) {
            classNameByClassId[row.classId] = row.className
          }
        })
        enrollments.forEach((row) => {
          if (row.classId && row.className && !classNameByClassId[row.classId]) {
            classNameByClassId[row.classId] = row.className
          }
        })

        const cards = classDocs.map((classDoc) => {
          const fromClassModules = (moduleMapByClass[classDoc.id] || []).map((m) => ({
            moduleId: m.moduleId,
            moduleName: m.moduleName || 'Module',
          }))
          const fromAccess = accessRows
            .filter((a) => a.classId === classDoc.id)
            .map((a) => ({
              moduleId: a.moduleId,
              moduleName: a.moduleName || 'Module',
            }))
          const fromCodes = codeRows
            .filter((c) => c.classId === classDoc.id)
            .map((c) => ({
              moduleId: c.moduleId,
              moduleName: c.moduleName || 'Module',
            }))

          const seen = new Set()
          const classModules = [...fromClassModules, ...fromAccess, ...fromCodes].filter((m) => {
            if (!m.moduleId || seen.has(m.moduleId)) return false
            seen.add(m.moduleId)
            return true
          })

          const modules = classModules.map((m) => {
            const unlocked = accessMap[keyFor(classDoc.id, m.moduleId)] === true
            return {
              moduleId: m.moduleId,
              moduleName: m.moduleName || 'Module',
              unlocked,
              courseCode: courseCodeByModuleKey[keyFor(classDoc.id, m.moduleId)] || null,
            }
          })

          const enrollmentRow = enrollments.find((e) => e.classId === classDoc.id)
          const inferredName = (classDoc.name && classDoc.name !== 'Class')
            ? classDoc.name
            : enrollmentRow?.className || classNameByClassId[classDoc.id] || 'Class'

          return {
            id: classDoc.id,
            name: inferredName,
            teacherName: classDoc.teacherName || classDoc.teacherUid || enrollmentRow?.teacherName || null,
            modules,
          }
        })
        setClassCards(cards)
      } catch {
        setError('Could not fully load your student dashboard. Some class data may be restricted by current Firebase rules.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [currentUser])

  const enrolledCourses = useMemo(
    () => classCards.length,
    [classCards],
  )
  const coursesLabel = enrolledCourses === 1 ? 'Course' : 'Courses'

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[var(--color-bg-canvas)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(65,90,119,0.34),rgba(65,90,119,0)_54%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(27,38,59,0.14),rgba(27,38,59,0.02)_42%,rgba(65,90,119,0.2)_100%)]" />

      <header className="relative z-10 border-b border-[rgba(65,90,119,0.24)] bg-[linear-gradient(180deg,rgba(248,249,250,0.86),rgba(233,240,247,0.76))] backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark containerClassName="w-10 h-10 rounded-xl bg-[var(--color-brand-50)] border border-[var(--color-brand-100)] p-1" />
            <div>
              <p className="text-[0.95rem] font-semibold text-[var(--color-text-primary)]">Student Dashboard</p>
              <p className="text-xs text-[var(--color-text-muted)]">{currentUser?.displayName || currentUser?.email}</p>
            </div>
          </div>
          <Button onClick={onLogout} variant="secondary" size="md">Logout</Button>
        </div>
      </header>

      <main className="relative z-10 max-w-[1240px] mx-auto px-6 py-8 space-y-5">
        <Panel className="p-5 md:p-6 bg-[linear-gradient(152deg,rgba(236,243,250,0.9),rgba(221,232,244,0.76))] border-[rgba(65,90,119,0.24)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Your Learning Workspace</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Modules unlock here when your teacher enables them.
              </p>
            </div>
            <Badge tone="brand">{enrolledCourses} {coursesLabel}</Badge>
          </div>
        </Panel>

        {error && (
          <div className="rounded-lg border border-[rgba(220,38,38,0.25)] bg-[rgba(254,242,242,0.8)] px-3 py-2 text-sm text-[var(--color-danger-600)]">
            {error}
          </div>
        )}

        {loading ? (
          <Panel className="p-6 text-sm text-[var(--color-text-secondary)]">Loading classes...</Panel>
        ) : classCards.length === 0 ? (
          <Panel className="p-6 text-sm text-[var(--color-text-secondary)]">
            You are not enrolled in any classes yet. Ask your teacher to add your email to a class roster.
          </Panel>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {classCards.map((classCard) => (
              <Card key={classCard.id} className="p-5 border-[rgba(65,90,119,0.24)] bg-[linear-gradient(150deg,rgba(236,241,246,0.92),rgba(223,232,242,0.78))]">
                {(() => {
                  const unlockedCount = classCard.modules.filter((m) => m.unlocked).length
                  const totalCount = classCard.modules.length
                  const badgeText = unlockedCount === 0
                    ? 'Not activated yet'
                    : `${unlockedCount}/${totalCount} unlocked`
                  return (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{classCard.name}</h3>
                    {classCard.teacherName && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Teacher: {classCard.teacherName}</p>
                    )}
                  </div>
                  <Badge tone="neutral">{badgeText}</Badge>
                </div>
                  )
                })()}

                <div className="mt-3 space-y-2">
                  {classCard.modules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                      Your instructor has not activated any modules yet.
                    </div>
                  ) : classCard.modules.filter((m) => m.unlocked).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                      Your instructor has not activated any modules yet.
                    </div>
                  ) : classCard.modules.map((module) => (
                    <div key={module.moduleId} className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{module.moduleName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{module.unlocked ? 'Unlocked' : 'Locked by teacher'}</p>
                      </div>
                      <Button
                        type="button"
                        variant={module.unlocked ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={!module.unlocked}
                        onClick={() => {
                          const moduleData = {
                            classId: classCard.id,
                            moduleId: module.moduleId,
                            moduleName: module.moduleName,
                            teacherName: classCard.teacherName || null,
                            courseCode: module.courseCode || 'ENROLLED',
                          }
                          registerModule(module.moduleId, moduleData)
                          navigate(`/student/module/${module.moduleId}`)
                        }}
                      >
                        {module.unlocked ? 'Open Module' : 'Locked'}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
