import { useState, useRef } from 'react'
import { Badge, Button } from '../ui/primitives'

export default function DocumentPanel({ moduleId, documents, onDocumentsChanged }) {
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
      const docData = await uploadRes.json()
      await fetch(
        `http://localhost:8000/modules/${moduleId}/documents/${docData.id}/process`,
        { method: 'POST' },
      )
    } catch {
      /* handled via status */
    } finally {
      setUploading(false)
      onDocumentsChanged()
    }
  }

  const handleDelete = async (docId) => {
    try {
      await fetch(`http://localhost:8000/modules/${moduleId}/documents/${docId}`, { method: 'DELETE' })
    } catch {
      /* ignore */
    }
    onDocumentsChanged()
  }

  const statusBadge = (doc) => {
      const base = 'inline-block text-xs px-1.5 py-0.5 rounded-full font-medium'
      switch (doc.status) {
      case 'processing':
        return <Badge tone="warning" className={`${base} animate-pulse`}>processing</Badge>
      case 'processed':
        return (
          <Badge tone="success" className={base}>
            processed{doc.chunk_count != null ? ` (${doc.chunk_count})` : ''}
          </Badge>
        )
      case 'error':
        return (
          <Badge tone="danger" className={base} title={doc.error_message || 'Processing error'}>
            error
          </Badge>
        )
      default:
        return <Badge tone="neutral" className={base}>uploaded</Badge>
    }
  }

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</span>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="ghost"
          size="sm"
          className="text-indigo-600 hover:text-indigo-700"
        >
          {uploading ? 'Uploading...' : '+ Upload'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={handleUpload} className="hidden" />
      </div>

      {documents.length === 0 && !uploading && (
        <p className="text-xs text-gray-400 py-1">No documents yet.</p>
      )}

      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-gray-700" title={doc.filename}>{doc.original_filename}</span>
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
