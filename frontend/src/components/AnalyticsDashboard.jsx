import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function fmtTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function getBlockedSignal(text) {
  const val = String(text || '').toLowerCase()
  return val.includes('not able to provide that response') || val.includes('please rephrase your question')
}

function getLearnerKey(promptRow) {
  return promptRow.studentEmail || promptRow.studentUid || promptRow.courseCode || promptRow.sessionId || null
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
}

function looksLikeOpaqueId(value) {
  const raw = String(value || '')
  if (!raw) return false
  return raw.length > 20 || /^[a-z0-9-]{16,}$/i.test(raw)
}

export default function AnalyticsDashboard() {
  const { currentUser } = useAuth()
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterModule, setFilterModule] = useState('all')
  const [filterRange, setFilterRange] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState({})

  useEffect(() => {
    if (!currentUser) return
    const fetchPrompts = async () => {
      setLoading(true)
      setError(null)
      try {
        const q = query(collection(db, 'prompts'), where('teacherUid', '==', currentUser.uid))
        const snap = await getDocs(q)
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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

  const moduleOptions = useMemo(
    () => [
      ...new Map(
        prompts
          .filter((p) => p.moduleId)
          .map((p) => [p.moduleId, p.moduleName || p.moduleId]),
      ).entries(),
    ],
    [prompts],
  )

  const filtered = useMemo(() => {
    const now = Date.now()
    const search = searchTerm.trim().toLowerCase()
    return prompts.filter((row) => {
      if (filterModule !== 'all' && row.moduleId !== filterModule) return false

      const ts = row.timestamp?.toMillis?.() ?? 0
      if (filterRange === '7d' && ts < now - 7 * 24 * 60 * 60 * 1000) return false
      if (filterRange === '30d' && ts < now - 30 * 24 * 60 * 60 * 1000) return false

      if (search) {
        const haystack = [
          row.prompt,
          row.response,
          row.moduleName,
          row.moduleId,
          row.courseCode,
          row.studentEmail,
        ].join(' ').toLowerCase()
        if (!haystack.includes(search)) return false
      }

      return true
    })
  }, [filterModule, filterRange, prompts, searchTerm])

  const analytics = useMemo(() => {
    const sessions = new Set(filtered.map((p) => p.sessionId).filter(Boolean))
    const modules = new Set(filtered.map((p) => p.moduleId).filter(Boolean))
    const learners = new Set(filtered.map(getLearnerKey).filter(Boolean))

    const promptsPerSession = sessions.size ? (filtered.length / sessions.size) : 0

    const moduleCount = {}
    filtered.forEach((row) => {
      const key = row.moduleId || 'unknown'
      moduleCount[key] = (moduleCount[key] || 0) + 1
    })
    const mostActiveModuleId = Object.keys(moduleCount).sort((a, b) => moduleCount[b] - moduleCount[a])[0]
    const rawMostActiveModuleName = mostActiveModuleId
      ? (filtered.find((row) => row.moduleId === mostActiveModuleId)?.moduleName || mostActiveModuleId)
      : 'No module activity yet'
    const mostActiveModuleName = looksLikeOpaqueId(rawMostActiveModuleName)
      ? 'Unnamed Module'
      : rawMostActiveModuleName

    const wordCounts = {}
    filtered.forEach((row) => {
      tokenize(row.prompt).forEach((word) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })
    })
    const topKeyword = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a])[0] || 'No recurring topic yet'

    const blockedByLearner = {}
    filtered.forEach((row) => {
      if (!getBlockedSignal(row.response)) return
      const learner = getLearnerKey(row)
      if (!learner) return
      blockedByLearner[learner] = (blockedByLearner[learner] || 0) + 1
    })
    const needingAttention = Object.values(blockedByLearner).filter((count) => count >= 2).length

    return {
      totalPrompts: filtered.length,
      uniqueSessions: sessions.size,
      modulesUsed: modules.size,
      activeLearners: learners.size,
      avgPromptsPerSession: promptsPerSession.toFixed(1),
      mostActiveModuleName,
      topKeyword,
      needingAttention,
      lastUpdated: filtered[0]?.timestamp || null,
    }
  }, [filtered])

  const tableRows = useMemo(
    () => filtered.map((row) => ({
      ...row,
      status: getBlockedSignal(row.response) ? 'Needs Review' : 'Normal',
    })),
    [filtered],
  )

  const toggleExpanded = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[rgba(65,90,119,0.22)] bg-[linear-gradient(148deg,rgba(236,243,250,0.94),rgba(222,233,245,0.78))] p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Analytics Workspace</p>
            <h3 className="text-2xl md:text-[1.9rem] font-semibold text-[var(--color-text-primary)] mt-1">Student Conversation Insights</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">
              Track engagement, identify support patterns, and review classroom chat quality at a glance.
            </p>
          </div>
          <div className="rounded-lg border border-[rgba(65,90,119,0.2)] bg-white/70 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
            Last updated: {fmtTime(analytics.lastUpdated)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total Prompts" value={loading ? '…' : analytics.totalPrompts} tone="blue" />
        <StatCard label="Active Learners" value={loading ? '…' : analytics.activeLearners} tone="purple" />
        <StatCard label="Modules Used" value={loading ? '…' : analytics.modulesUsed} tone="green" />
        <StatCard label="Avg / Session" value={loading ? '…' : analytics.avgPromptsPerSession} tone="amber" />
      </section>

      {error && (
        <div className="rounded-lg border border-[rgba(220,38,38,0.25)] bg-[rgba(254,242,242,0.8)] px-4 py-3 text-sm text-[var(--color-danger-600)]">
          Failed to load analytics: {error}
        </div>
      )}

      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_290px] gap-4">
        <div className="space-y-3">
          <div className="sticky top-0 z-10 rounded-xl border border-[rgba(65,90,119,0.2)] bg-[rgba(248,249,250,0.86)] backdrop-blur-md p-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_220px] gap-2.5">
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="rounded-lg border border-[rgba(65,90,119,0.24)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(65,90,119,0.36)]"
              >
                <option value="all">All modules</option>
                {moduleOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select
                value={filterRange}
                onChange={(e) => setFilterRange(e.target.value)}
                className="rounded-lg border border-[rgba(65,90,119,0.24)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(65,90,119,0.36)]"
              >
                <option value="all">All time</option>
                <option value="30d">Last 30 days</option>
                <option value="7d">Last 7 days</option>
              </select>

              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompt, response, module, code…"
                className="rounded-lg border border-[rgba(65,90,119,0.24)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(65,90,119,0.36)]"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(65,90,119,0.2)] bg-white/75 overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(65,90,119,0.14)] flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Student Chat Logs</h4>
              <span className="text-xs text-[var(--color-text-muted)]">{tableRows.length} results</span>
            </div>

            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">Loading analytics…</div>
            ) : tableRows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
                No chats match this filter yet.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="sticky top-0 bg-[rgba(236,241,246,0.95)] backdrop-blur-sm border-b border-[rgba(65,90,119,0.16)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-36">Time</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-28">Code</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-40">Module</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-32">Status</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] min-w-[240px]">Student Prompt</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] min-w-[260px]">Tutor Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(65,90,119,0.1)]">
                    {tableRows.map((row, idx) => {
                      const isExpanded = Boolean(expandedRows[row.id])
                      return (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white/75 hover:bg-[rgba(236,241,246,0.74)]' : 'bg-[rgba(248,249,250,0.78)] hover:bg-[rgba(236,241,246,0.74)]'}>
                          <td className="px-3 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">{fmtTime(row.timestamp)}</td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{row.courseCode || '—'}</td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)] whitespace-nowrap">{row.moduleName || (row.moduleId ? `${row.moduleId.slice(0, 8)}…` : '—')}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-3 py-2.5 text-[var(--color-text-primary)] align-top">
                            <p className={isExpanded ? '' : 'line-clamp-2'}>{row.prompt || '—'}</p>
                            {(row.prompt || '').length > 90 && (
                              <button
                                type="button"
                                className="mt-1 text-[11px] font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                                onClick={() => toggleExpanded(row.id)}
                              >
                                {isExpanded ? 'Show less' : 'Expand'}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)] align-top">
                            <p className={isExpanded ? '' : 'line-clamp-2'}>{row.response || '—'}</p>
                            {(row.response || '').length > 120 && (
                              <button
                                type="button"
                                className="mt-1 text-[11px] font-medium text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
                                onClick={() => toggleExpanded(row.id)}
                              >
                                {isExpanded ? 'Show less' : 'Expand'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          <InsightCard
            title="Most Active Module"
            value={analytics.mostActiveModuleName}
            sub="Highest prompt volume in current filter"
          />
          <InsightCard
            title="Most Frequent Topic"
            value={analytics.topKeyword}
            sub="Top recurring keyword from student prompts"
          />
          <InsightCard
            title="Students Needing Attention"
            value={String(analytics.needingAttention)}
            sub="Learners with repeated blocked-response patterns"
          />
          <InsightCard
            title="Unique Sessions"
            value={String(analytics.uniqueSessions)}
            sub="Distinct conversation threads in current filter"
          />
        </aside>
      </section>
    </div>
  )
}

function StatCard({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'from-[rgba(65,90,119,0.28)] to-[rgba(65,90,119,0.12)] text-[var(--color-primary-700)]',
    purple: 'from-[rgba(91,83,214,0.26)] to-[rgba(65,90,119,0.12)] text-[var(--color-primary-700)]',
    green: 'from-[rgba(45,106,79,0.24)] to-[rgba(65,90,119,0.1)] text-[var(--color-primary-700)]',
    amber: 'from-[rgba(186,147,74,0.24)] to-[rgba(65,90,119,0.1)] text-[var(--color-primary-700)]',
  }
  return (
    <div className="rounded-xl border border-[rgba(65,90,119,0.2)] bg-[linear-gradient(150deg,rgba(248,249,250,0.94),rgba(234,241,248,0.8))] p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tones[tone]} flex items-center justify-center font-semibold text-lg`}>
        {value}
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
    </div>
  )
}

function InsightCard({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-[rgba(65,90,119,0.2)] bg-[linear-gradient(152deg,rgba(248,249,250,0.92),rgba(233,240,247,0.8))] p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{title}</p>
      <p className="text-base font-semibold text-[var(--color-text-primary)] mt-2 break-words">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">{sub}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const isReview = status === 'Needs Review'
  return (
    <span className={isReview
      ? 'inline-flex items-center rounded-full border border-[rgba(220,38,38,0.25)] bg-[rgba(254,242,242,0.9)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger-600)]'
      : 'inline-flex items-center rounded-full border border-[rgba(45,106,79,0.25)] bg-[rgba(240,253,244,0.9)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success-700)]'
    }
    >
      {status}
    </span>
  )
}
