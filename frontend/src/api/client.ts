// Fetch wrapper used by every service call. Adds the auth token and turns error responses into ApiError.

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'tradehub.token'

let token: string | null = localStorage.getItem(TOKEN_KEY)
let onUnauthorized: () => void = () => {}

export function getToken(): string | null {
  return token
}

export function setToken(next: string | null): void {
  token = next
  if (next) localStorage.setItem(TOKEN_KEY, next)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Called when a signed-in request gets 401 (expired or revoked token). AuthProvider registers it. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export class ApiError extends Error {
  readonly status: number
  /** Per-field messages from DRF 400 responses, keyed by field name. */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const FALLBACK: Record<number, string> = {
  0: 'Cannot reach the server. Check that the backend is running.',
  400: 'Please fix the highlighted fields.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You are not allowed to do that.',
  404: 'That could not be found.',
  409: 'That action conflicts with the current market state.',
  500: 'Something went wrong on the server. Please try again.',
}

function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

function toApiError(status: number, body: unknown): ApiError {
  const fieldErrors: Record<string, string> = {}
  let detail: string | null = null
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body)) {
      const msg = firstMessage(value)
      if (!msg) continue
      if (key === 'detail' || key === 'non_field_errors') detail = msg
      else fieldErrors[key] = msg
    }
  }
  const message = detail ?? (status === 401 ? null : Object.values(fieldErrors)[0]) ?? FALLBACK[status] ?? FALLBACK[500]
  return new ApiError(status, message, fieldErrors)
}

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Token ${token}`

  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, FALLBACK[0])
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw toApiError(res.status, data)
  }
  return data as T
}

export function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(500, FALLBACK[500])
}
