import { APP_COPY, ENTRY_COPY } from '../content/strings'
import { AppShell, Card } from './ui/primitives'
import LogoMark from './common/LogoMark'
import { useState } from 'react'
import StudentLoginPage from './StudentLoginPage'
import TeacherLoginPage from './TeacherLoginPage'
import studentPfpIcon from '../assets/studentPFP.png'
import teacherPfpIcon from '../assets/teacherPFP.png'

export default function EntryPage({
  onStudentEntry,
  onTeacherEntry,
  onStudentAuthSuccess,
  onTeacherAuthSuccess,
}) {
  const [expanded, setExpanded] = useState(null)

  return (
    <AppShell className="px-0 min-h-screen overflow-x-hidden lg:h-screen lg:overflow-hidden">
      <div className="min-h-screen lg:h-full grid grid-cols-1 lg:grid-cols-[minmax(340px,480px)_1fr]">
        <section className="bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)] px-8 py-10 lg:px-10 lg:py-12 flex items-start lg:items-center lg:h-screen lg:overflow-y-auto">
          <div className="w-full max-w-md mx-auto">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-3">
              {APP_COPY.appName}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight text-[var(--color-text-primary)]">
              {ENTRY_COPY.heroTitle}
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-4 mb-8">
              {ENTRY_COPY.heroSubtitle}
            </p>

            <div className="flex flex-col gap-3">
              {(() => {
                const studentActive = expanded === 'student'
                return (
              <button
                onClick={() => {
                  onStudentEntry?.()
                  setExpanded((prev) => (prev === 'student' ? null : 'student'))
                }}
                className="group text-left"
              >
                <Card
                  interactive
                  className={[
                    'tp-interactive-card p-5 flex items-center gap-6 transition-colors',
                    studentActive
                      ? 'tp-card-active bg-[var(--color-brand-600)] border-[var(--color-brand-600)] shadow-[0_12px_28px_rgba(79,70,229,0.32)]'
                      : '',
                  ].join(' ')}
                >
                  <img
                    src={studentPfpIcon}
                    alt="Student icon"
                    className="w-20 h-20 object-contain flex-shrink-0"
                  />
                  <div>
                    <p className={['text-lg font-semibold', studentActive ? 'text-white' : 'text-gray-800'].join(' ')}>{ENTRY_COPY.studentTitle}</p>
                    <p className={['text-sm mt-0.5', studentActive ? 'text-indigo-100' : 'text-gray-500'].join(' ')}>{ENTRY_COPY.studentSubtitle}</p>
                  </div>
                </Card>
              </button>
                )
              })()}
              {expanded === 'student' && onStudentAuthSuccess && (
                <div className="tp-sheet-enter pt-1">
                  <StudentLoginPage
                    embedded
                    onSuccess={() => onStudentAuthSuccess?.()}
                  />
                </div>
              )}

              {(() => {
                const teacherActive = expanded === 'teacher'
                return (
                  <button
                    onClick={() => {
                      onTeacherEntry?.()
                      setExpanded((prev) => (prev === 'teacher' ? null : 'teacher'))
                    }}
                    className="group text-left"
                  >
                    <Card
                      interactive
                      className={[
                        'tp-interactive-card p-5 flex items-center gap-6 transition-colors',
                        teacherActive
                          ? 'tp-card-active bg-[var(--color-brand-600)] border-[var(--color-brand-600)] shadow-[0_12px_28px_rgba(79,70,229,0.32)]'
                          : '',
                      ].join(' ')}
                    >
                      <img
                        src={teacherPfpIcon}
                        alt="Teacher icon"
                        className="w-20 h-20 object-contain flex-shrink-0"
                      />
                      <div>
                        <p className={['text-lg font-semibold', teacherActive ? 'text-white' : 'text-gray-800'].join(' ')}>{ENTRY_COPY.teacherTitle}</p>
                        <p className={['text-sm mt-0.5', teacherActive ? 'text-indigo-100' : 'text-gray-500'].join(' ')}>{ENTRY_COPY.teacherSubtitle}</p>
                      </div>
                    </Card>
                  </button>
                )
              })()}
              {expanded === 'teacher' && onTeacherAuthSuccess && (
                <div className="tp-sheet-enter pt-1">
                  <TeacherLoginPage
                    embedded
                    onSuccess={() => onTeacherAuthSuccess?.()}
                  />
                </div>
              )}
            </div>

            <p className="text-sm text-[var(--color-text-muted)] mt-8">
              {APP_COPY.appTagline}
            </p>
          </div>
        </section>

        <section className="hidden lg:flex relative overflow-hidden items-center justify-center h-screen bg-gradient-to-br from-[var(--color-primary-700)] via-[var(--color-primary-700)] to-[var(--color-secondary-600)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(255,255,255,0.24),rgba(255,255,255,0)_56%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(9,14,24,0.82)_16%,rgba(9,14,24,0.08)_67%,rgba(255,255,255,0.18)_100%)]" />
          <div className="relative z-10 w-[min(70vw,760px)] h-[min(70vw,760px)] rounded-[2.75rem] p-7 bg-gradient-to-br from-[rgba(253,254,255,0.74)] via-[rgba(238,243,249,0.62)] to-[rgba(215,225,237,0.56)] shadow-[0_24px_64px_rgba(0,0,0,0.34)] border border-white/45 backdrop-blur-[3px]">
            <div className="pointer-events-none absolute inset-0 rounded-[2.75rem] bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_6%,rgba(255,255,255,0.08)_34%,rgba(27,38,59,0.05)_58%,rgba(255,255,255,0.2)_100%)]" />
            <LogoMark
              alt={ENTRY_COPY.visualAlt}
              containerClassName="relative z-10 w-full h-full rounded-[2.25rem] bg-transparent overflow-hidden"
              imgClassName="rounded-[2.25rem] brightness-[0.92] saturate-[0.88] contrast-[0.96] mix-blend-multiply drop-shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
            />
          </div>
        </section>
      </div>
    </AppShell>
  )
}
