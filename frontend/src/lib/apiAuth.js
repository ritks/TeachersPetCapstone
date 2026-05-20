import { apiUrl } from './api'

export async function apiFetch(path, { user = null, method = 'GET', body = null, headers = {} } = {}) {
  const h = { ...headers }
  if (body != null) {
    h['Content-Type'] = 'application/json'
  }
  if (user) {
    const token = await user.getIdToken()
    h.Authorization = `Bearer ${token}`
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers: h,
    body: body != null ? JSON.stringify(body) : undefined,
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const detail = typeof data === 'object' && data?.detail ? data.detail : `Request failed (${res.status})`
    throw new Error(detail)
  }

  return data
}
