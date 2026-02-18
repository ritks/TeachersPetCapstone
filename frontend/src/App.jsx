import { useState, useRef, useEffect } from 'react'

const WELCOME_MESSAGE = {
  role: 'tutor',
  content:
    "Hello! I'm Teacher's Pet, your math tutor. Feel free to ask me any math question — I'll walk you through it step by step.",
}

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [modules, setModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documents, setDocuments] = useState([])
  const scrollRef = useRef(null)

  const refreshDocuments = async (moduleId) => {
    const id = moduleId ?? selectedModuleId
    if (!id) { setDocuments([]); return }
    try {
      const res = await fetch(`http://localhost:8000/modules/${id}/documents`)
      const data = await res.json()
      setDocuments(data)
    } catch {
      setDocuments([])
    }
  }

  const refreshModules = async () => {
    try {
      const res = await fetch('http://localhost:8000/modules')
      const data = await res.json()
      setModules(data)
    } catch {
      /* silently ignore — modules list is non-critical */
    }
  }

  useEffect(() => {
    refreshModules()
  }, [])

  useEffect(() => {
    refreshDocuments()
    setMessages([WELCOME_MESSAGE])
    setSessionId(null)
  }, [selectedModuleId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'student', content: question }])
    setLoading(true)

    try {
      const body = { question, session_id: sessionId }
      if (selectedModuleId) body.module_id = selectedModuleId

      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setSessionId(data.session_id)
      setMessages((prev) => [
        ...prev,
        { role: 'tutor', content: data.answer, isError: data.error },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          content:
            "I couldn't reach the server. Make sure the backend is running on port 8000 and try again.",
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-row h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        modules={modules}
        selectedModuleId={selectedModuleId}
        onSelect={setSelectedModuleId}
        onModuleCreated={refreshModules}
        documents={documents}
        onDocumentsChanged={refreshDocuments}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header selectedModule={selectedModule} />

        {/* scrollable message list */}
        <section className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {messages.map((msg, i) => (
              <Bubble key={i} message={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={scrollRef} />
          </div>
        </section>

        <InputBar
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={loading}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- sidebar */
function Sidebar({ open, onToggle, modules, selectedModuleId, onSelect, onModuleCreated, documents, onDocumentsChanged }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name || creating) return

    setCreating(true)
    try {
      const res = await fetch('http://localhost:8000/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: newDesc.trim() || undefined }),
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

  /* collapsed state — just a toggle button */
  if (!open) {
    return (
      <div className="flex flex-col items-center border-r border-gray-200 bg-white/60 py-4 px-1">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center hover:bg-purple-200 transition-colors"
          title="Open sidebar"
        >
          &#9776;
        </button>
      </div>
    )
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white/60 backdrop-blur-sm flex flex-col">
      {/* sidebar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Modules</span>
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors text-xs"
          title="Close sidebar"
        >
          &#10005;
        </button>
      </div>

      {/* module list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        {/* no-module option */}
        <button
          onClick={() => onSelect(null)}
          className={[
            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            selectedModuleId === null
              ? 'bg-purple-100 text-purple-800 font-medium'
              : 'text-gray-600 hover:bg-gray-100',
          ].join(' ')}
        >
          No module (general chat)
        </button>

        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onSelect(mod.id)}
            className={[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              selectedModuleId === mod.id
                ? 'bg-purple-100 text-purple-800 font-medium'
                : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            <span className="block truncate">{mod.name}</span>
            {mod.description && (
              <span className="block text-xs text-gray-400 truncate">{mod.description}</span>
            )}
          </button>
        ))}
      </div>

      {/* documents */}
      {selectedModuleId && (
        <DocumentPanel
          moduleId={selectedModuleId}
          documents={documents}
          onDocumentsChanged={onDocumentsChanged}
        />
      )}

      {/* create module */}
      <div className="border-t border-gray-100 px-3 py-3">
        {showCreateForm ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Module name"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="flex-1 rounded-md bg-purple-600 text-white text-sm py-1.5 font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md border border-gray-300 text-gray-600 text-sm px-3 py-1.5 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full rounded-md border border-dashed border-purple-300 text-purple-600 text-sm py-2 font-medium hover:bg-purple-50 transition-colors"
          >
            + Create Module
          </button>
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------- documents */
function DocumentPanel({ moduleId, documents, onDocumentsChanged }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await fetch(
        `http://localhost:8000/modules/${moduleId}/documents`,
        { method: 'POST', body: form },
      )
      const doc = await uploadRes.json()

      await fetch(
        `http://localhost:8000/modules/${moduleId}/documents/${doc.id}/process`,
        { method: 'POST' },
      )
    } catch {
      /* handled via status in document list */
    } finally {
      setUploading(false)
      onDocumentsChanged()
    }
  }

  const handleDelete = async (docId) => {
    try {
      await fetch(
        `http://localhost:8000/modules/${moduleId}/documents/${docId}`,
        { method: 'DELETE' },
      )
    } catch {
      /* ignore */
    }
    onDocumentsChanged()
  }

  const statusBadge = (doc) => {
    const base = 'inline-block text-xs px-1.5 py-0.5 rounded-full font-medium'
    switch (doc.status) {
      case 'processing':
        return <span className={`${base} bg-amber-100 text-amber-700 animate-pulse`}>processing</span>
      case 'processed':
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            processed{doc.chunk_count != null ? ` (${doc.chunk_count})` : ''}
          </span>
        )
      case 'error':
        return (
          <span className={`${base} bg-red-100 text-red-600`} title={doc.error_message || 'Processing error'}>
            error
          </span>
        )
      default:
        return <span className={`${base} bg-gray-100 text-gray-500`}>uploaded</span>
    }
  }

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-40"
        >
          {uploading ? 'Uploading...' : '+ Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {documents.length === 0 && !uploading && (
        <p className="text-xs text-gray-400 py-1">No documents yet.</p>
      )}

      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-gray-700" title={doc.filename}>{doc.filename}</span>
              {statusBadge(doc)}
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="flex-shrink-0 w-5 h-5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              title="Delete document"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {uploading && (
        <div className="flex items-center gap-1.5 py-1 text-xs text-amber-600">
          <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Uploading & processing...
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- header */
function Header({ selectedModule }) {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 shadow-md">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <Avatar />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Teacher's Pet</h1>
          <p className="text-purple-200 text-sm">
            {selectedModule
              ? `Module: ${selectedModule.name}`
              : 'AI-Powered Math Tutor'}
          </p>
        </div>
      </div>
    </header>
  )
}

/* --------------------------------------------------------- avatar */
function Avatar() {
  return (
    <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold tracking-wider">TP</span>
    </div>
  )
}

/* ------------------------------------------------- message bubble */
function Bubble({ message }) {
  const isStudent = message.role === 'student'

  return (
    <div className={`flex items-end gap-2 ${isStudent ? 'flex-row-reverse' : ''}`}>
      {!isStudent && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-xs font-bold">TP</span>
        </div>
      )}

      <div
        className={[
          'max-w-[75%] px-4 py-2.5 shadow-sm',
          isStudent
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl rounded-br-sm'
            : message.isError
              ? 'bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm'
              : 'bg-white border border-gray-100 rounded-2xl rounded-bl-sm',
        ].join(' ')}
      >
        <p
          className={[
            'text-sm leading-relaxed whitespace-pre-wrap',
            isStudent
              ? 'text-white'
              : message.isError
                ? 'text-red-600'
                : 'text-gray-700',
          ].join(' ')}
        >
          {message.content}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ typing dots */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">TP</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-3">
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------- input bar */
function InputBar({ value, onChange, onSubmit, disabled }) {
  return (
    <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-4">
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask a math question..."
          disabled={disabled}
          className="flex-1 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </form>
    </div>
  )
}
