import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function AnalyticsDashboard() {
  const { currentUser } = useAuth()
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterModule, setFilterModule] = useState('all')

  useEffect(() => {
    if (!currentUser) return
    const fetchPrompts = async () => {
      setLoading(true)
      setError(null)
      try {
        const q = query(
          collection(db, 'prompts'),
          where('teacherUid', '==', currentUser.uid),
        )
        const snap = await getDocs(q)
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // sort client-side — avoids needing a Firestore composite index
        docs.sort((a, b) => {
          const ta = a.timestamp?.toMillis?.() ?? 0
          const tb = b.timestamp?.toMillis?.() ?? 0
          return tb - ta
        })
        setPrompts(docs)
      } catch (err) {
        console.error('Analytics fetch failed:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPrompts()
  }, [currentUser])

  // build unique module list using moduleName when available
  const moduleOptions = [
    ...new Map(
      prompts
        .filter((p) => p.moduleId)
        .map((p) => [p.moduleId, p.moduleName || p.moduleId]),
    ).entries(),
  ]
  const sessions = new Set(prompts.map((p) => p.sessionId).filter(Boolean))

  const filtered = filterModule === 'all'
    ? prompts
    : prompts.filter((p) => p.moduleId === filterModule)

  const fmt = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Prompts" value={loading ? '…' : prompts.length} color="blue" />
        <StatCard label="Unique Sessions" value={loading ? '…' : sessions.size} color="purple" />
        <StatCard label="Modules Used" value={loading ? '…' : moduleOptions.length} color="green" />
      </div>

      {/* error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          Failed to load analytics: {error}
        </div>
      )}

      {/* module filter */}
      {moduleOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Filter by module:</label>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="all">All modules</option>
            {moduleOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Student Chat Logs</h3>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No chats logged yet. Students will appear here once they start chatting.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-32">Time</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-24">Code</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-32">Module</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Student Prompt</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Tutor Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{fmt(p.timestamp)}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">{p.courseCode || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{p.moduleName || (p.moduleId ? p.moduleId.slice(0, 8) + '…' : '—')}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[200px]">
                      <span className="line-clamp-2">{p.prompt}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[200px]">
                      <span className="line-clamp-2">{p.response}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-lg font-bold">{value}</span>
      </div>
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </div>
  )
}
