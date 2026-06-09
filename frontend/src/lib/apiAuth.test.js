import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch } from './apiAuth'

function mockResponse({ ok = true, status = 200, body = '' } = {}) {
  return { ok, status, text: vi.fn().mockResolvedValue(body) }
}

function stubFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiFetch', () => {
  it('sends a plain GET with no auth or content-type headers', async () => {
    const fetchMock = stubFetch(mockResponse({ body: JSON.stringify({ ok: true }) }))

    const data = await apiFetch('/me')

    expect(data).toEqual({ ok: true })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('/me')
    expect(opts.method).toBe('GET')
    expect(opts.headers.Authorization).toBeUndefined()
    expect(opts.headers['Content-Type']).toBeUndefined()
    expect(opts.body).toBeUndefined()
  })

  it('serializes a JSON body and sets the content-type', async () => {
    const fetchMock = stubFetch(mockResponse({ body: '{}' }))

    await apiFetch('/modules', { method: 'POST', body: { name: 'Fractions' } })

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.body).toBe(JSON.stringify({ name: 'Fractions' }))
  })

  it('attaches a bearer token when a user is provided', async () => {
    const fetchMock = stubFetch(mockResponse({ body: '{}' }))
    const user = { getIdToken: vi.fn().mockResolvedValue('token-123') }

    await apiFetch('/me', { user })

    expect(user.getIdToken).toHaveBeenCalled()
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer token-123')
  })

  it('returns raw text when the response is not JSON', async () => {
    stubFetch(mockResponse({ body: 'plain text' }))
    expect(await apiFetch('/ping')).toBe('plain text')
  })

  it('returns null when the response body is empty', async () => {
    stubFetch(mockResponse({ body: '' }))
    expect(await apiFetch('/ping')).toBeNull()
  })

  it('throws the server-provided detail on error responses', async () => {
    stubFetch(mockResponse({ ok: false, status: 400, body: JSON.stringify({ detail: 'Bad input' }) }))
    await expect(apiFetch('/modules')).rejects.toThrow('Bad input')
  })

  it('throws a generic message when no detail is present', async () => {
    stubFetch(mockResponse({ ok: false, status: 500, body: '' }))
    await expect(apiFetch('/modules')).rejects.toThrow('Request failed (500)')
  })
})