import { useState, useRef } from 'react'
import { Button, Input } from '../ui/primitives'

export default function StudentSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onClearAllHistory = null,
  moduleName,
  teacherName,
  mobileFullScreen = false,
  onClose = null,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const editInputRef = useRef(null)

  const startRename = (session, e) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditValue(session.title)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  const commitRename = () => {
    if (editValue.trim()) onRenameSession(editingId, editValue.trim())
    setEditingId(null)
  }

  const confirmDelete = (e, sessionId) => {
    e.stopPropagation()
    setConfirmDeleteId(sessionId)
  }

  return (
    <aside
      className={[
        'relative w-full md:w-72 flex-shrink-0 border-[var(--color-border-card-subtle)] tp-card-surface-soft',
        mobileFullScreen ? 'border-b-0 md:border-b-0 md:border-r' : 'border-b md:border-b-0 md:border-r',
        mobileFullScreen ? 'h-full md:h-full' : 'h-[45vh] md:h-full',
        'flex flex-col overflow-hidden min-h-0',
      ].join(' ')}
    >
      {mobileFullScreen && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 md:hidden rounded-md p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors flex items-center justify-center"
          aria-label="Close sessions"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border-card-subtle)]">
        <Button
          onClick={onNewSession}
          variant="secondary"
          size="md"
          className="w-full flex items-center gap-2 justify-start bg-white/85 border-[var(--color-border-card-subtle)] shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[var(--color-secondary-600)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </Button>
        {onClearAllHistory && (
          <Button
            onClick={onClearAllHistory}
            variant="danger"
            size="md"
            className="w-full mt-2"
          >
            Clear All History
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        <p className="text-[0.68rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.12em] mb-2 px-1">
          Recent Learning
        </p>
        <div className="flex flex-col gap-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={[
                'group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer border',
                activeSessionId === session.id
                  ? 'bg-[var(--color-brand-50)] text-[var(--color-text-primary)] border-[var(--color-brand-500)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] border-transparent hover:bg-white/80 hover:border-[var(--color-border-card-subtle)]',
              ].join(' ')}
              onClick={() => editingId !== session.id && onSelectSession(session.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {editingId === session.id ? (
                <Input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm bg-white rounded px-1.5 py-0.5"
                />
              ) : (
                <>
                  <span className="truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => startRename(session, e)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-brand-600)] transition-opacity"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => confirmDelete(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-[var(--color-text-muted)] hover:text-red-500 transition-opacity"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {confirmDeleteId && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 rounded-none md:rounded-r-none">
          <div className="bg-white rounded-xl shadow-lg mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Delete this session?</p>
              <p className="text-xs text-gray-500 mt-1">This will permanently remove the chat history and cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setConfirmDeleteId(null)}
                variant="secondary"
                size="md"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { onDeleteSession(confirmDeleteId); setConfirmDeleteId(null) }}
                variant="danger"
                size="md"
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-[var(--color-border-card-subtle)] px-4 py-3 flex flex-col gap-2.5 bg-white/45">
        <div className="min-w-0">
          <p className="text-[0.64rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.12em] mb-0.5">
            Module
          </p>
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {moduleName || 'No module selected'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[0.64rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.12em] mb-0.5">
            Teacher
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] truncate">
            {teacherName || 'Teacher not available'}
          </p>
        </div>
      </div>
    </aside>
  )
}
