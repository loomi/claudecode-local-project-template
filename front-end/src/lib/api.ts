import type { AuthTokens } from '@/types/auth'
import { tokenStore } from './token-store'

// Defaults to '/api' (same-origin) so the production build "just works"
// behind the ingress that routes /api/* to the backend Service. For local
// dev, set NEXT_PUBLIC_API_URL=http://localhost:3001/api in .env.local —
// see .env.example.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api' 

interface BackendEnvelope<T> {
  success: true
  data: T
  timestamp: string
}

interface BackendError {
  statusCode: number
  error: string
  message: string | string[]
  path: string
  timestamp: string
}

export class ApiError extends Error {
  status: number
  details: string[]

  constructor(message: string, status: number, details: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/** HTTP statuses emitted by a backend that is still cold-starting / waking. */
const TRANSIENT_STATUSES = new Set([502, 503, 504])

/**
 * True for errors that signal the server never processed the request and a
 * retry is safe: network/timeout (ApiError status 0) or a transient 5xx.
 * Shared with the React Query layer so retry policy stays DRY.
 */
export function isTransientError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || TRANSIENT_STATUSES.has(err.status)
  }
  // A non-ApiError (e.g. a raw TypeError from fetch) is treated as network.
  return err instanceof Error
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
  skipRefresh?: boolean
  /** Per-call request timeout in ms. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number
  /** Per-call max retries on transient/cold-start failures. */
  retries?: number
  /** Invoked before each cold-start retry so the UX can show a wake hint. */
  onWakeRetry?: (attempt: number) => void
}

/** ~15s cold start + margin. */
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_RETRIES = 4
const BASE_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 8_000

let refreshPromise: Promise<AuthTokens> | null = null

async function refreshTokens(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise

  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) {
    throw new ApiError('No refresh token available', 401)
  }

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      tokenStore.clear()
      throw new ApiError('Session expired', res.status)
    }
    const json = (await res.json()) as BackendEnvelope<AuthTokens>
    tokenStore.set(json.data)
    return json.data
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

/** fetch with an AbortController timeout. Throws ApiError(0) on timeout. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 0)
    }
    // Network-level failure (connection refused, DNS, etc.).
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      0,
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Exponential backoff with small deterministic jitter, capped. */
function backoffDelay(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
  // Deterministic-ish jitter: up to +25% of base, no crypto needed.
  const jitter = (base / 4) * ((attempt * 7) % 4) * 0.25
  return Math.min(base + jitter, MAX_BACKOFF_MS)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: BackendError | null = null
  try {
    payload = (await res.json()) as BackendError
  } catch {
    /* noop */
  }
  const messageRaw = payload?.message ?? res.statusText ?? 'Request failed'
  const details = Array.isArray(messageRaw) ? messageRaw : [messageRaw]
  const message = details[0] ?? 'Request failed'
  return new ApiError(message, res.status, details)
}

/** Single request attempt: applies timeout, headers, and 401-refresh. */
async function attemptRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const {
    body,
    auth = true,
    headers,
    skipRefresh,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    // Pull retry-only fields out so they don't leak into RequestInit.
    retries: _retries,
    onWakeRetry: _onWakeRetry,
    ...rest
  } = options

  const finalHeaders: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(headers as Record<string, string> | undefined),
  }

  if (auth) {
    const access = tokenStore.getAccess()
    if (access) finalHeaders['Authorization'] = `Bearer ${access}`
  }

  const res = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    timeoutMs,
  )

  if (res.status === 401 && auth && !skipRefresh && tokenStore.getRefresh()) {
    try {
      await refreshTokens()
    } catch (err) {
      tokenStore.clear()
      throw err
    }
    return attemptRequest<T>(path, { ...options, skipRefresh: true })
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) return undefined as T

  const json = (await res.json()) as BackendEnvelope<T>
  return json.data
}

/**
 * Public entry point: retries transient/cold-start failures with backoff.
 * Retries cover all methods on connection-level + 502/503/504 signals —
 * the server never processed the request, so even POST/PATCH/DELETE are
 * safe to replay in this window.
 */
async function rawRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const maxRetries = options.retries ?? DEFAULT_MAX_RETRIES

  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptRequest<T>(path, options)
    } catch (err) {
      if (attempt >= maxRetries || !isTransientError(err)) throw err
      options.onWakeRetry?.(attempt + 1)
      await sleep(backoffDelay(attempt))
    }
  }
}

export const api = {
  get: <T,>(path: string, options: RequestOptions = {}): Promise<T> =>
    rawRequest<T>(path, { ...options, method: 'GET' }),
  post: <T,>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> => rawRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T,>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> => rawRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T,>(path: string, options: RequestOptions = {}): Promise<T> =>
    rawRequest<T>(path, { ...options, method: 'DELETE' }),
}