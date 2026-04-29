import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'
import { Badge, StatCard } from './ui/primitives'

function fmtTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function getBlockedSignal(text) {
  const val = String(text || '').toLowerCase()
  return val.includes('not able to provide that response') || val.includes('please rephrase your question')
}

const CATEGORY_LABELS = {
  unsafe_content: 'Unsafe Content',
  misuse: 'Misuse',
  validation_failure: 'Validation Failure',
  system_error: 'System Error',
  quality_error: 'Quality Error',
  none: 'Normal',
}

const CATEGORY_SEVERITY = {
  unsafe_content: 'high',
  misuse: 'high',
  validation_failure: 'medium',
  system_error: 'high',
  quality_error: 'medium',
  none: 'low',
}

function getFlagMeta(row) {
  const explicitCategory = String(row.flagCategory || '').trim()
  const explicitSeverity = String(row.flagSeverity || '').trim()

  if (explicitCategory) {
    const category = explicitCategory
    const severity = explicitSeverity || CATEGORY_SEVERITY[category] || 'medium'
    const flagged = category !== 'none'
    return {
      category,
      severity,
      flagged,
      label: CATEGORY_LABELS[category] || category,
    }
  }

  if (getBlockedSignal(row.response)) {
    return {
      category: 'unsafe_content',
      severity: 'high',
      flagged: true,
      label: CATEGORY_LABELS.unsafe_content,
    }
  }

  return {
    category: 'none',
    severity: 'low',
    flagged: false,
    label: CATEGORY_LABELS.none,
  }
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
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterRange, setFilterRange] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState({})
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [summaryMeta, setSummaryMeta] = useState(null)

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

  const categoryOptions = useMemo(
    () => [
      ...new Map(
        prompts.map((row) => {
          const meta = getFlagMeta(row)
          return [meta.category, meta.label]
        }),
      ).entries(),
    ],
    [prompts],
  )

  const filtered = useMemo(() => {
    const now = Date.now()
    const search = searchTerm.trim().toLowerCase()
    return prompts.filter((row) => {
      if (filterModule !== 'all' && row.moduleId !== filterModule) return false
      if (filterCategory !== 'all') {
        const meta = getFlagMeta(row)
        if (meta.category !== filterCategory) return false
      }

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
  }, [filterCategory, filterModule, filterRange, prompts, searchTerm])

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
      const meta = getFlagMeta(row)
      if (!meta.flagged) return
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
      flagMeta: getFlagMeta(row),
      status: getFlagMeta(row).flagged ? 'Needs Review' : 'Normal',
    })),
    [filtered],
  )

  const toggleExpanded = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleGenerateSummary = async () => {
    if (!currentUser?.uid || summaryLoading) return
    setSummaryLoading(true)
    setSummaryError('')

    try {
      const sampledRows = filtered.slice(0, 180).map((row) => {
        const meta = getFlagMeta(row)
        return {
          module_name: row.moduleName || null,
          course_code: row.courseCode || null,
          prompt: row.prompt || '',
          response: row.response || '',
          flag_category: meta.category,
          flag_severity: meta.severity,
          timestamp: row.timestamp?.toDate?.()?.toISOString?.() || null,
        }
      })

      const res = await fetch(apiUrl('/analytics/summary'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_uid: currentUser.uid,
          module_filter: filterModule,
          category_filter: filterCategory,
          range_filter: filterRange,
          rows: sampledRows,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.detail || 'Summary request failed')
      }

      setAiSummary(data.summary || '')
      setSummaryMeta({
        generatedAt: data.generated_at || null,
        totalRows: data.total_rows ?? filtered.length,
        sampledRows: data.sampled_rows ?? sampledRows.length,
      })
    } catch (err) {
      setSummaryError(err?.message || 'Could not generate summary.')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--color-border-card)] tp-card-surface p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="tp-eyebrow">Analytics Workspace</p>
            <h3 className="text-2xl md:text-[1.9rem] font-semibold text-[var(--color-text-primary)] mt-1">Student Conversation Insights</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">
              Track engagement, identify support patterns, and review classroom chat quality at a glance.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-border-card-subtle)] bg-white/70 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
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
        <div className="rounded-lg border border-[var(--color-danger-500)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-600)]">
          Failed to load analytics: {error}
        </div>
      )}

      <section className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <p className="tp-eyebrow">AI Summary</p>
            <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mt-1">Classroom Trend Snapshot</h4>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Generate a quick AI summary from the currently filtered chat logs.
            </p>
          </div>
          <button
            type="button"
            disabled={summaryLoading}
            onClick={handleGenerateSummary}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-card-subtle)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            {summaryLoading ? 'Generating...' : (aiSummary ? 'Refresh Summary' : 'Generate Summary')}
          </button>
        </div>

        {summaryError && (
          <div className="mt-3 rounded-lg border border-[var(--color-danger-500)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-600)]">
            {summaryError}
          </div>
        )}

        {aiSummary ? (
          <div className="mt-3 rounded-lg border border-[var(--color-border-card-subtle)] bg-white/75 p-3">
            <pre className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)] font-sans leading-6">{aiSummary}</pre>
            {summaryMeta && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Generated: {fmtTime(summaryMeta.generatedAt)} · Sampled {summaryMeta.sampledRows} of {summaryMeta.totalRows} rows
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            No summary yet. Generate one to see key trends, common struggles, and suggested actions.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_290px] gap-4">
        <div className="space-y-3">
          <div className="sticky top-0 z-10 rounded-xl border border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)] backdrop-blur-md p-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_220px_220px] gap-2.5">
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="tp-input"
              >
                <option value="all">All modules</option>
                {moduleOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select
                value={filterRange}
                onChange={(e) => setFilterRange(e.target.value)}
                className="tp-input"
              >
                <option value="all">All time</option>
                <option value="30d">Last 30 days</option>
                <option value="7d">Last 7 days</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="tp-input"
              >
                <option value="all">All categories</option>
                {categoryOptions.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>

              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompt, response, module, code…"
                className="tp-input"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border-card-subtle)] bg-white/75 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-card-subtle)] flex items-center justify-between gap-2">
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
                  <thead className="sticky top-0 bg-[var(--bg-frosted-muted)] backdrop-blur-sm border-b border-[var(--color-border-card-subtle)]">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-36">Time</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-28">Code</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-40">Module</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-40">Category</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] w-32">Status</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] min-w-[240px]">Student Prompt</th>
                      <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] min-w-[260px]">Tutor Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(65,90,119,0.1)]">
                    {tableRows.map((row, idx) => {
                      const isExpanded = Boolean(expandedRows[row.id])
                      return (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white/75 hover:bg-[var(--bg-hover)]' : 'bg-[var(--color-bg-muted)] hover:bg-[var(--bg-hover)]'}>
                          <td className="px-3 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">{fmtTime(row.timestamp)}</td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)] font-mono whitespace-nowrap">{row.courseCode || '—'}</td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)] whitespace-nowrap">{row.moduleName || (row.moduleId ? `${row.moduleId.slice(0, 8)}…` : '—')}</td>
                          <td className="px-3 py-2.5">
                            <CategoryBadge label={row.flagMeta.label} flagged={row.flagMeta.flagged} />
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={row.status} severity={row.flagMeta.severity} />
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

function InsightCard({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft p-4">
      <p className="tp-eyebrow">{title}</p>
      <p className="text-base font-semibold text-[var(--color-text-primary)] mt-2 break-words">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">{sub}</p>
    </div>
  )
}

function CategoryBadge({ label, flagged }) {
  return <Badge tone={flagged ? 'warning' : 'success'}>{label}</Badge>
}

function StatusBadge({ status, severity = 'low' }) {
  if (status !== 'Needs Review') return <Badge tone="success">{status}</Badge>
  return <Badge tone={severity === 'high' ? 'danger' : 'warning'}>{status}</Badge>
}
