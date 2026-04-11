import { useState, useRef } from 'react'
import { Badge, Button, Input } from '../ui/primitives'

export default function StudentSidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onRenameSession, onDeleteSession, courseCode, moduleName, teacherName, onLogout }) {
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
    <aside className="relative w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-3 pt-4 pb-3 border-b border-gray-100">
        <Button
          onClick={onNewSession}
          variant="subtle"
          size="md"
          className="w-full flex items-center gap-2 justify-start"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Recent Learning
        </p>
        <div className="flex flex-col gap-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={[
                'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                activeSessionId === session.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
              onClick={() => editingId !== session.id && onSelectSession(session.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-indigo-500 transition-opacity"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => confirmDelete(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-red-500 transition-opacity"
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
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10 rounded-r-none" style={{ borderRadius: 0 }}>
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

      <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-2">
        {moduleName && (
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="truncate font-medium">{moduleName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge tone="brand" className="font-mono tracking-widest">
            {courseCode}
          </Badge>
          {teacherName && (
            <span className="text-xs text-gray-400 truncate">by {teacherName}</span>
          )}
        </div>
        <Button
          onClick={onLogout}
          variant="secondary"
          size="sm"
          className="w-full hover:bg-red-50 hover:text-red-500"
        >
          Leave Session
        </Button>
      </div>
    </aside>
  )
}
