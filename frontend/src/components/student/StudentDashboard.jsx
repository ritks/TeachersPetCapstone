import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Panel } from '../ui/primitives'
import LogoMark from '../common/LogoMark'
import { useStudent } from '../../contexts/StudentContext'
import { apiFetch } from '../../lib/apiAuth'
import ThemeToggleButton from '../common/ThemeToggleButton'

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
        const cards = await apiFetch('/student/dashboard', { user: currentUser })
        const normalized = (Array.isArray(cards) ? cards : []).map((card) => ({
          id: card.id,
          name: card.name,
          teacherName: card.teacher_name ?? card.teacherName ?? null,
          modules: (card.modules || []).map((m) => ({
            moduleId: m.moduleId ?? m.module_id,
            moduleName: m.moduleName ?? m.module_name ?? 'Module',
            moduleDescription: m.moduleDescription ?? m.module_description ?? null,
            moduleStatus: m.moduleStatus ?? m.module_status ?? 'active',
            unlocked: Boolean(m.unlocked),
            courseCode: m.courseCode ?? m.course_code ?? null,
          })),
        }))
        setClassCards(normalized)
      } catch {
        setError('Could not fully load your student dashboard. Please try again.')
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

      <header className="relative z-10 border-b border-[var(--color-border-card-subtle)] tp-header-surface backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark containerClassName="w-10 h-10 rounded-xl bg-[var(--color-brand-50)] border border-[var(--color-brand-100)] p-1" />
            <div>
              <p className="text-[0.95rem] font-semibold text-[var(--color-text-primary)]">Student Dashboard</p>
              <p className="text-xs text-[var(--color-text-muted)]">{currentUser?.displayName || currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <Button onClick={onLogout} variant="secondary" size="md">Logout</Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1240px] mx-auto px-6 py-8 space-y-5">
        <Panel className="p-5 md:p-6 tp-card-surface border-[var(--color-border-card-subtle)] backdrop-blur-sm">
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
              <Card key={classCard.id} className="p-5 border-[var(--color-border-card-subtle)] tp-card-surface">
                {(() => {
                  const visibleModules = classCard.modules.filter((m) => m.moduleStatus !== 'archived')
                  const unlockedCount = visibleModules.filter((m) => m.unlocked).length
                  const totalCount = visibleModules.length
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
                  {classCard.modules.filter((m) => m.moduleStatus !== 'archived').length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                      Your instructor has not activated any modules yet.
                    </div>
                  ) : classCard.modules.filter((m) => m.moduleStatus !== 'archived' && m.unlocked).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(65,90,119,0.28)] bg-white/55 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                      Your instructor has not activated any modules yet.
                    </div>
                  ) : classCard.modules.filter((module) => module.moduleStatus !== 'archived').map((module) => (
                    <div key={module.moduleId} className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{module.moduleName}</p>
                        {module.moduleDescription && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                            {module.moduleDescription}
                          </p>
                        )}
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
                            moduleDescription: module.moduleDescription || null,
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
