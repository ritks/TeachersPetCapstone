import { useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function StudentEntryPage({ onSuccess }) {
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
        setError("Invalid code. Ask your teacher for the correct code.")
        return
      }
      const { moduleId, moduleName, teacherUid } = snap.data()
      const studentData = { courseCode: trimmed, moduleId, moduleName, teacherUid: teacherUid ?? null }
      localStorage.setItem('tp_student', JSON.stringify(studentData))
      onSuccess(studentData)
    } catch {
      setError('Could not verify the code. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-lg">TP</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Join a Class</h2>
          <p className="text-gray-500 text-sm mt-1">Enter the code your teacher gave you</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={6}
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />

            <button
              type="submit"
              disabled={loading || code.trim().length < 1}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold py-2.5 shadow-sm hover:shadow-md hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 transition-all"
            >
              {loading ? 'Checking...' : 'Join Class'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
