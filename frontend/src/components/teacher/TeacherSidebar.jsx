import { useEffect, useState } from 'react'
import DocumentPanel from './DocumentPanel'
import { Badge, Button, Input } from '../ui/primitives'
import { apiUrl } from '../../lib/api'
import { apiFetch } from '../../lib/apiAuth'

export default function TeacherSidebar({
  open,
  onToggle,
  modules,
  selectedModuleId,
  onSelect,
  onModuleCreated,
  documents,
  onDocumentsChanged,
  currentUser,
  createUniqueCode,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [courseCodes, setCourseCodes] = useState({})
  const [generatingFor, setGeneratingFor] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  useEffect(() => {
    if (!currentUser || modules.length === 0) return

    const fetchCodes = async () => {
      const rows = await apiFetch(`/course-codes?teacher_uid=${encodeURIComponent(currentUser.uid)}`, {
        user: currentUser,
      })
      const map = {}
      ;(Array.isArray(rows) ? rows : []).forEach((row) => { map[row.module_id] = row.code })
      setCourseCodes(map)
    }

    fetchCodes().catch(() => {})
  }, [currentUser, modules])

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || creating) return

    setCreating(true)
    try {
      const body = { name, description: newDesc.trim() || undefined }
      if (currentUser) body.teacher_uid = currentUser.uid

      const res = await fetch(apiUrl('/modules'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const created = await res.json()
      await onModuleCreated()
      onSelect(created.id)
      setNewName('')
      setNewDesc('')
      setShowCreateForm(false)
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateCode = async (mod) => {
    setGeneratingFor(mod.id)
    try {
      const code = await createUniqueCode()
      await apiFetch('/course-codes', {
        user: currentUser,
        method: 'POST',
        body: {
          code,
          module_id: mod.id,
          module_name: mod.name,
          teacher_name: currentUser?.displayName || currentUser?.email || null,
        },
      })
      setCourseCodes((prev) => ({ ...prev, [mod.id]: code }))
    } catch (err) {
      alert(`Failed to generate code: ${err.message}`)
    } finally {
      setGeneratingFor(null)
    }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  if (!open) {
    return (
      <div className="flex flex-col items-center border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] py-4 px-1">
        <Button
          onClick={onToggle}
          variant="subtle"
          size="icon"
          className="w-8 h-8 text-indigo-600 hover:bg-indigo-100"
          title="Open sidebar"
        >
          &#9776;
        </Button>
      </div>
    )
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">Modules</span>
        <Button
          onClick={onToggle}
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] text-xs"
          title="Close sidebar"
        >
          &#10005;
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        <button
          onClick={() => onSelect(null)}
          className={[
            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            selectedModuleId === null
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100',
          ].join(' ')}
        >
          No module (general chat)
        </button>

        {modules.map((mod) => (
          <div key={mod.id} className="flex flex-col gap-0.5">
            <button
              onClick={() => onSelect(mod.id)}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedModuleId === mod.id
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <span className="block truncate">{mod.name}</span>
              {mod.description && (
                <span className="block text-xs text-gray-400 truncate">{mod.description}</span>
              )}
            </button>

            <div className="px-3 pb-1">
              {courseCodes[mod.id] ? (
                <div className="flex items-center gap-1.5">
                  <Badge tone="brand" className="font-mono tracking-widest">
                    {courseCodes[mod.id]}
                  </Badge>
                  <button
                    onClick={() => copyCode(courseCodes[mod.id])}
                    className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === courseCodes[mod.id] ? '✓' : '⧉'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleGenerateCode(mod)}
                  disabled={generatingFor === mod.id}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium disabled:opacity-40 transition-colors"
                >
                  {generatingFor === mod.id ? 'Generating…' : '+ Generate Code'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedModuleId && (
        <DocumentPanel
          moduleId={selectedModuleId}
          documents={documents}
          onDocumentsChanged={onDocumentsChanged}
        />
      )}

      <div className="border-t border-gray-100 px-3 py-3">
        {showCreateForm ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Module name"
              className="w-full py-1.5"
              autoFocus
            />
            <Input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full py-1.5"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={!newName.trim() || creating}
                variant="primary"
                size="md"
                className="flex-1"
              >
                {creating ? 'Creating...' : 'Create'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowCreateForm(false)}
                variant="secondary"
                size="md"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="secondary"
            size="md"
            className="w-full border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            + Create Module
          </Button>
        )}
      </div>
    </aside>
  )
}
