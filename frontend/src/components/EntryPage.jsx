import { APP_COPY, ENTRY_COPY } from '../content/strings'
import { AppShell, Card } from './ui/primitives'
import LogoMark from './common/LogoMark'
import { useState } from 'react'
import StudentLoginPage from './StudentLoginPage'
import TeacherLoginPage from './TeacherLoginPage'
import studentPfpIcon from '../assets/studentPFP.png'
import teacherPfpIcon from '../assets/teacherPFP.png'
import logoMarkSrc from '../assets/teacherspetlogo-mark.png'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function IconWrap({ className = '', children }) {
  return (
    <div
      className={cx(
        'pointer-events-none absolute grid place-items-center select-none',
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  )
}

function MathText({ text, className = '' }) {
  return (
    <span
      className={cx(
        'font-semibold tracking-tight',
        className,
      )}
      aria-hidden
    >
      {text}
    </span>
  )
}

function PencilIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M16 34L34 16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M14.5 36.5l-2 7 7-2L41 20a3.5 3.5 0 0 0 0-5l-3-3a3.5 3.5 0 0 0-5 0L14.5 36.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M30 14l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
}

function RulerIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M14 10h20a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18 14v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M22 14v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M26 14v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M30 14v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M34 14v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

function NotebookIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M14 10h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M16 16h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M16 22h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M16 28h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
      <path d="M12 10v28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

function CalculatorIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M16 8h16a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M18 20h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M25 20h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M18 26h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M25 26h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M18 32h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M25 32h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

function BeakerIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M19 6h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 6v10l-9 17a8 8 0 0 0 7.1 11h11.8A8 8 0 0 0 37 33l-9-17V6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 30h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M18 34c2-1.6 4.2-2.3 6.5-2.3S29 32.4 31 34"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

function HeroPatternLayer() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none"
      aria-hidden
    >
      <IconWrap className="left-4 top-[6%] opacity-55 rotate-[-10deg]">
        <MathText text="π" className="text-amber-200 text-2xl sm:text-3xl" />
      </IconWrap>
      <IconWrap className="right-[6%] top-[10%] opacity-35 rotate-6">
        <MathText text="√" className="text-slate-200 text-2xl sm:text-3xl" />
      </IconWrap>
      <IconWrap className="left-[10%] top-[28%] opacity-30 rotate-[8deg]">
        <MathText text="×" className="text-slate-300 text-2xl sm:text-3xl" />
      </IconWrap>
      <IconWrap className="right-[14%] top-[26%] opacity-42 -rotate-6">
        <MathText text="÷" className="text-sky-200 text-2xl sm:text-3xl" />
      </IconWrap>
      <IconWrap className="left-[20%] top-[52%] opacity-28 rotate-[-8deg]">
        <MathText text="+" className="text-slate-200 text-2xl sm:text-3xl" />
      </IconWrap>
      <IconWrap className="right-[28%] top-[56%] opacity-28 rotate-3">
        <MathText text="−" className="text-slate-200 text-3xl" />
      </IconWrap>

      <IconWrap className="right-[4%] top-[40%] opacity-60 rotate-[10deg]">
        <BeakerIcon className="h-10 w-10 text-emerald-200/85" />
      </IconWrap>
      <IconWrap className="left-[4%] bottom-[22%] opacity-55 -rotate-[12deg]">
        <PencilIcon className="h-10 w-10 text-amber-200/85" />
      </IconWrap>
      <IconWrap className="left-[34%] top-[12%] opacity-35 rotate-6">
        <RulerIcon className="h-9 w-9 text-slate-200/70" />
      </IconWrap>
      <IconWrap className="right-[34%] top-[18%] opacity-28 rotate-[-8deg]">
        <NotebookIcon className="h-9 w-9 text-slate-200/60" />
      </IconWrap>
      <IconWrap className="left-[52%] top-[34%] opacity-22 rotate-[10deg]">
        <CalculatorIcon className="h-9 w-9 text-sky-200/55" />
      </IconWrap>
      <IconWrap className="right-[22%] bottom-[26%] opacity-22 -rotate-[10deg]">
        <MathText text="=" className="text-slate-200 text-3xl" />
      </IconWrap>
      <IconWrap className="left-[18%] bottom-[8%] opacity-18 rotate-6">
        <MathText text="∞" className="text-slate-200 text-2xl" />
      </IconWrap>
      <IconWrap className="right-[42%] bottom-[6%] opacity-16 -rotate-[6deg]">
        <MathText text="%" className="text-slate-200 text-2xl" />
      </IconWrap>

      <IconWrap className="right-[10%] bottom-[12%] opacity-22 rotate-[2deg]">
        <MathText text="∠" className="text-slate-200 text-3xl" />
      </IconWrap>
      <IconWrap className="left-[44%] bottom-[6%] opacity-18 -rotate-3">
        <MathText text="∑" className="text-slate-200 text-2xl" />
      </IconWrap>
    </div>
  )
}

function LightColumnPatterns() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      aria-hidden
    >
      <IconWrap className="right-2 top-6 opacity-18 rotate-3">
        <MathText text="×" className="text-slate-400 text-2xl" />
      </IconWrap>
      <IconWrap className="left-3 bottom-20 opacity-16 -rotate-6">
        <MathText text="π" className="text-slate-400 text-2xl" />
      </IconWrap>
      <IconWrap className="right-[12%] bottom-8 opacity-14 rotate-12">
        <PencilIcon className="h-7 w-7 text-slate-400/60" />
      </IconWrap>
      <IconWrap className="left-[6%] top-1/3 opacity-12 -rotate-6">
        <BeakerIcon className="h-7 w-7 text-emerald-400/40" />
      </IconWrap>
      <IconWrap className="right-[18%] top-[42%] opacity-10 rotate-6">
        <CalculatorIcon className="h-7 w-7 text-slate-400/55" />
      </IconWrap>
      <IconWrap className="left-[10%] top-[18%] opacity-10 -rotate-3">
        <MathText text="√" className="text-slate-400 text-xl" />
      </IconWrap>
      <IconWrap className="right-[8%] top-[22%] opacity-9 rotate-3">
        <MathText text="=" className="text-slate-400 text-xl" />
      </IconWrap>
    </div>
  )
}

function HeroCollage() {
  return (
    <div className="relative mt-10 lg:mt-12 min-h-[200px] sm:min-h-[220px] w-full max-w-[560px]">
      <div
        className="absolute -left-4 top-6 h-32 w-40 rotate-[-8deg] rounded-[2rem] bg-gradient-to-br from-emerald-400/90 to-teal-600/85 opacity-95 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
        aria-hidden
      >
        <svg className="h-full w-full p-3 text-white/35" viewBox="0 0 100 100" fill="none">
          <path
            d="M10 50 Q30 20 50 50 T90 50"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15 70 Q40 40 60 70"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
      <div
        className="absolute left-[18%] top-0 z-10 h-[88px] w-[88px] overflow-hidden rounded-full border-4 border-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.28)] sm:h-[100px] sm:w-[100px]"
      >
        <img src={studentPfpIcon} alt="" className="h-full w-full object-contain bg-white" />
      </div>
      <div
        className="absolute left-[42%] top-8 z-20 h-[100px] w-[100px] overflow-hidden rounded-[1.35rem] border-4 border-amber-200/90 shadow-[0_16px_36px_rgba(0,0,0,0.26)] rotate-[6deg] sm:h-[112px] sm:w-[112px]"
      >
        <img src={teacherPfpIcon} alt="" className="h-full w-full object-contain bg-white p-1" />
      </div>
      <div
        className="absolute right-[4%] top-2 z-10 h-[80px] w-[80px] overflow-hidden rounded-full border-4 border-cyan-200/80 shadow-[0_12px_28px_rgba(0,0,0,0.22)] sm:h-[92px] sm:w-[92px]"
      >
        <img src={studentPfpIcon} alt="" className="h-full w-full object-contain scale-110 bg-sky-50" />
      </div>
      <IconWrap className="right-[2%] top-[34%] z-20 opacity-40 rotate-[6deg]">
        <MathText text="π" className="text-white/70 text-2xl" />
      </IconWrap>
      <IconWrap className="left-[28%] bottom-0 z-0 opacity-55 -rotate-[10deg]">
        <PencilIcon className="h-9 w-9 text-amber-200/85" />
      </IconWrap>
      <IconWrap className="right-[18%] bottom-4 z-0 opacity-40 rotate-[8deg]">
        <BeakerIcon className="h-9 w-9 text-emerald-200/80" />
      </IconWrap>
      <IconWrap className="right-[34%] bottom-0 z-[1] opacity-45 rotate-[-10deg]">
        <MathText text="÷" className="text-amber-200 text-2xl" />
      </IconWrap>
      <IconWrap className="left-[40%] bottom-1 z-[1] opacity-25 rotate-[3deg]">
        <MathText text="+" className="text-white/70 text-2xl" />
      </IconWrap>
      <IconWrap className="-right-1 bottom-8 z-[1] opacity-55 rotate-[4deg]">
        <RulerIcon className="h-8 w-8 text-slate-200/70" />
      </IconWrap>
    </div>
  )
}

export default function EntryPage({ onStudentEntry, onTeacherEntry }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <AppShell className="min-h-screen flex flex-col p-0 overflow-x-hidden bg-white">
      <div className="relative min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-[minmax(520px,1.1fr)_minmax(420px,0.9fr)] overflow-hidden bg-[#0a1628]">
        {/* Shared background layers across both columns (removes seam) */}
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_85%_70%_at_15%_35%,rgba(99,102,241,0.22),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(45,106,79,0.2),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-1/2 z-0 h-72 w-72 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl"
          aria-hidden
        />
        <HeroPatternLayer />

        <section className="relative z-10 flex flex-1 flex-col justify-between overflow-hidden bg-transparent px-6 py-10 sm:px-10 sm:py-12 lg:h-screen lg:py-14 lg:pr-8">

          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
            <div className="mb-6 flex items-center gap-5">
              <LogoMark
                src={logoMarkSrc}
                alt={ENTRY_COPY.visualAlt}
                containerClassName="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-[1.4rem] bg-white p-0.5 shadow-[0_18px_40px_rgba(0,0,0,0.3)] ring-2 ring-white/35"
                imgClassName="rounded-2xl scale-[1.02]"
              />
              <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Teacher&apos;s{' '}
                <span className="text-sky-200 drop-shadow-[0_10px_24px_rgba(56,189,248,0.18)]">Pet</span>
              </span>
            </div>

            <p
              className="text-[1.65rem] font-medium leading-tight text-white sm:text-3xl lg:text-[2.15rem] lg:leading-[1.15]"
              style={{ fontFamily: '\"Fraunces\", ui-serif, Georgia, serif' }}
            >
              {APP_COPY.appTagline}
            </p>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-slate-300 sm:text-base">
              {ENTRY_COPY.heroSubtitle}
            </p>
            <div className="mt-2 flex w-full justify-center">
              <HeroCollage />
            </div>
          </div>
        </section>

        <section className="relative z-10 flex flex-1 flex-col items-stretch justify-start overflow-hidden bg-transparent px-4 py-10 sm:px-8 sm:py-12 lg:h-screen lg:justify-center lg:overflow-y-auto lg:px-10 lg:py-12">
          <LightColumnPatterns />

          <div className="relative z-10 mx-auto w-full max-w-2xl lg:mx-0 lg:mr-auto lg:-translate-x-6">
            <div className="min-h-[380px] sm:min-h-[440px] rounded-[2rem] border border-white/18 bg-white/95 p-7 shadow-[0_26px_70px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-9 flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
                {ENTRY_COPY.heroTitle}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Pick Student or Teacher to get started with the right tools for your classroom.
              </p>

              <div className="mt-6 flex flex-col gap-3 flex-1">
                {(() => {
                  const studentActive = expanded === 'student'
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onStudentEntry?.()
                        setExpanded((prev) => (prev === 'student' ? null : 'student'))
                      }}
                      className="group text-left"
                    >
                      <Card
                        interactive
                        className={[
                          'tp-interactive-card p-4 sm:p-5 flex items-center gap-4 sm:gap-5 transition-all rounded-2xl border-2',
                          studentActive
                            ? 'tp-card-active border-[var(--color-brand-500)] bg-gradient-to-br from-[var(--color-brand-600)] to-indigo-700 text-white shadow-[0_16px_40px_rgba(79,70,229,0.38)]'
                            : 'border-slate-200/80 hover:border-indigo-200 hover:shadow-md',
                        ].join(' ')}
                      >
                        <img
                          src={studentPfpIcon}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                        />
                        <div>
                          <p className={['text-base font-semibold sm:text-lg', studentActive ? 'text-white' : 'text-slate-900'].join(' ')}>
                            {ENTRY_COPY.studentTitle}
                          </p>
                          <p className={['text-sm mt-0.5', studentActive ? 'text-indigo-100' : 'text-slate-500'].join(' ')}>
                            {ENTRY_COPY.studentSubtitle}
                          </p>
                        </div>
                      </Card>
                    </button>
                  )
                })()}
                {expanded === 'student' && (
                  <div className="tp-sheet-enter -mx-1 pt-1">
                    <StudentLoginPage embedded />
                  </div>
                )}

                {(() => {
                  const teacherActive = expanded === 'teacher'
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onTeacherEntry?.()
                        setExpanded((prev) => (prev === 'teacher' ? null : 'teacher'))
                      }}
                      className="group text-left"
                    >
                      <Card
                        interactive
                        className={[
                          'tp-interactive-card p-4 sm:p-5 flex items-center gap-4 sm:gap-5 transition-all rounded-2xl border-2',
                          teacherActive
                            ? 'tp-card-active border-[var(--color-brand-500)] bg-gradient-to-br from-[var(--color-brand-600)] to-indigo-700 text-white shadow-[0_16px_40px_rgba(79,70,229,0.38)]'
                            : 'border-slate-200/80 hover:border-indigo-200 hover:shadow-md',
                        ].join(' ')}
                      >
                        <img
                          src={teacherPfpIcon}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                        />
                        <div>
                          <p className={['text-base font-semibold sm:text-lg', teacherActive ? 'text-white' : 'text-slate-900'].join(' ')}>
                            {ENTRY_COPY.teacherTitle}
                          </p>
                          <p className={['text-sm mt-0.5', teacherActive ? 'text-indigo-100' : 'text-slate-500'].join(' ')}>
                            {ENTRY_COPY.teacherSubtitle}
                          </p>
                        </div>
                      </Card>
                    </button>
                  )
                })()}
                {expanded === 'teacher' && (
                  <div className="tp-sheet-enter -mx-1 pt-1">
                    <TeacherLoginPage embedded />
                  </div>
                )}
              </div>

              <p className="mt-6 text-center text-xs text-slate-500 sm:text-left">
                Secure sign-in. Your class data stays with your school account.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
