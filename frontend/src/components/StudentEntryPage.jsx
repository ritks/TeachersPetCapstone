import { useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { STUDENT_ENTRY_COPY } from '../content/strings'
import { AppShell, Button, Input, Panel } from './ui/primitives'
import LogoMark from './common/LogoMark'

export default function StudentEntryPage({ onSuccess, embedded = false }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    setError('')
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, 'courseCodes', trimmed))
      if (!snap.exists()) {
        setError(STUDENT_ENTRY_COPY.invalidCode)
        return
      }
      const { moduleId, moduleName, teacherUid, teacherName } = snap.data()
      const studentData = { courseCode: trimmed, moduleId, moduleName, teacherUid: teacherUid ?? null, teacherName: teacherName ?? null }
      localStorage.setItem('tp_student', JSON.stringify(studentData))
      onSuccess(studentData)
    } catch {
      setError(STUDENT_ENTRY_COPY.verifyError)
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <div className="w-full max-w-sm">
      {!embedded && (
        <div className="text-center mb-8">
          <LogoMark containerClassName="w-14 h-14 rounded-full border border-white/60 mx-auto mb-3 shadow-lg p-1 bg-gradient-to-br from-blue-500 to-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">{STUDENT_ENTRY_COPY.title}</h2>
          <p className="text-gray-500 text-sm mt-1">{STUDENT_ENTRY_COPY.subtitle}</p>
        </div>
      )}

      <Panel className={embedded ? 'p-5 bg-white/92 backdrop-blur-sm border-indigo-100 shadow-[0_14px_32px_rgba(27,38,59,0.12)]' : 'p-6'}>
        {embedded && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800">{STUDENT_ENTRY_COPY.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{STUDENT_ENTRY_COPY.subtitle}</p>
          </div>
        )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={STUDENT_ENTRY_COPY.inputPlaceholder}
              maxLength={6}
              autoFocus
              className="px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] uppercase"
            />

            <Button
              type="submit"
              disabled={loading || code.trim().length < 1}
              variant="primary"
              size="lg"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 border-transparent hover:from-blue-600 hover:to-blue-700"
            >
              {loading ? STUDENT_ENTRY_COPY.checking : STUDENT_ENTRY_COPY.submit}
            </Button>
          </form>
        </Panel>
    </div>
  )

  if (embedded) return content

  return (
    <AppShell className="bg-gradient-to-br from-sky-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4">
      {content}
    </AppShell>
  )
}
