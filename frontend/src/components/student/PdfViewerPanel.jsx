import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { apiUrl } from '../../lib/api'
import { Button } from '../ui/primitives'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PdfViewerPanel({ citations, moduleId, onClose }) {
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [containerWidth, setContainerWidth] = useState(null)
  const containerRef = useRef(null)

  // Track previous prop identities via state (React-approved pattern)
  const [prevDocId, setPrevDocId] = useState(null)
  const [prevCitations, setPrevCitations] = useState(citations)

  // Derive PDF citations, target doc and page from props
  const pdfCitations = useMemo(
    () => (citations || []).filter(
      (c) => c.document_id && c.original_filename?.toLowerCase().endsWith('.pdf')
    ),
    [citations],
  )

  const targetDocId = pdfCitations[0]?.document_id || null
  const targetPage = pdfCitations[0]?.page_start || 1
  const activeFilename = pdfCitations[0]?.original_filename || ''

  // Derive the PDF URL — only changes when the target document changes
  const pdfUrl = useMemo(() => {
    if (!targetDocId || !moduleId) return null
    return apiUrl(`/modules/${moduleId}/documents/${targetDocId}/file`)
  }, [targetDocId, moduleId])

  // When the document changes, reset loading state
  if (prevDocId !== targetDocId) {
    setPrevDocId(targetDocId)
    if (targetDocId) {
      setLoading(true)
      setError(null)
      setNumPages(null)
    }
  }

  // When citations change, jump to the cited page
  if (prevCitations !== citations) {
    setPrevCitations(citations)
    if (targetPage) {
      setCurrentPage(targetPage)
    }
  }

  // Track container width for responsive PDF scaling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const onDocumentLoadSuccess = useCallback(({ numPages: pages }) => {
    setNumPages(pages)
    setLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err) => {
    setError(err?.message || 'Failed to load PDF')
    setLoading(false)
  }, [])

  const goToPage = (page) => {
    if (page >= 1 && page <= numPages) setCurrentPage(page)
  }

  // If no PDF citations, show placeholder
  if (!pdfUrl) {
    return (
      <div className="flex flex-col h-full border-t md:border-t-0 md:border-l border-[var(--color-border-card-subtle)] bg-[var(--color-bg-canvas)]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)] backdrop-blur-sm flex-shrink-0">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Document Viewer</span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            title="Close viewer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No PDF references yet. Ask a question and relevant textbook pages will appear here.
          </p>
        </div>
      </div>
    )
  }

  // Deduplicate cited pages for the page indicator
  const citedPages = [...new Set(pdfCitations.map((c) => c.page_start).filter(Boolean))]

  return (
    <div className="flex flex-col h-full border-t md:border-t-0 md:border-l border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)] backdrop-blur-sm flex-shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate" title={activeFilename}>
            {activeFilename || 'Document'}
          </p>
          {numPages && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Page {currentPage} of {numPages}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors flex-shrink-0"
          title="Close viewer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Page navigation */}
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-b border-[var(--color-border-card-subtle)] bg-[var(--bg-frosted)] flex-shrink-0">
        <Button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          variant="secondary"
          size="sm"
          className="px-2 py-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Button>

        {citedPages.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-center">
            {citedPages.map((p) => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={[
                  'text-xs px-2 py-0.5 rounded-full border transition-colors',
                  currentPage === p
                    ? 'bg-[var(--color-brand-600)] text-white border-[var(--color-brand-600)]'
                    : 'bg-[var(--color-warning-50)] text-[var(--color-warning-600)] border-[var(--color-warning-600)] hover:bg-[var(--color-bg-muted)]',
                ].join(' ')}
                title={`Go to cited page ${p}`}
              >
                p.{p}
              </button>
            ))}
          </div>
        )}

        <Button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          variant="secondary"
          size="sm"
          className="px-2 py-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Button>
      </div>

      {/* PDF content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto flex justify-center bg-[var(--color-bg-canvas)] p-4">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--color-danger-500)]">{error}</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-32">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[var(--color-brand-500)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            }
          >
            {!loading && (
              <Page
                pageNumber={currentPage}
                width={containerWidth ? Math.min(containerWidth - 32, 800) : 600}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            )}
          </Document>
        )}
      </div>
    </div>
  )
}
