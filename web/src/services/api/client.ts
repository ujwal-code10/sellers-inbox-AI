const API_BASE = '/api'

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.length > 0 ? maybeError : null
}

function extractRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeRequestId = (payload as { requestId?: unknown }).requestId
  return typeof maybeRequestId === 'string' && maybeRequestId.length > 0
    ? maybeRequestId
    : null
}

export class ApiHttpClient {
  private refreshPromise: Promise<boolean> | null = null

  constructor(private readonly base: string) {}

  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') {
      return null
    }

    const match = document.cookie.match(/(?:^|; )sia_csrf=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  private isSafeMethod(method: string): boolean {
    const normalized = method.toUpperCase()
    return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS'
  }

  private shouldAttemptRefresh(endpoint: string): boolean {
    const refreshExclusions = [
      '/auth/login',
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/refresh',
      '/auth/logout',
    ]

    return !refreshExclusions.some((path) => endpoint.startsWith(path))
  }

  private async refreshSession(): Promise<boolean> {
    // SOURCE: many requests can fail with 401 at the same time when access token expires.
    // RISK: parallel refresh attempts can race and invalidate each other.
    // PROTECTION: collapse to a single in-flight refresh promise shared by all callers.
    // RESULT: retry flow is stable under bursty concurrent API requests.
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.base}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })

        return response.ok
      } catch {
        return false
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRetry: boolean = true
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase()
    const csrfToken = this.getCsrfToken()

    const headers = new Headers(options.headers)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (!this.isSafeMethod(method) && csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }

    const response = await fetch(`${this.base}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (
      response.status === 401 &&
      allowRetry &&
      this.shouldAttemptRefresh(endpoint)
    ) {
      const refreshed = await this.refreshSession()
      if (refreshed) {
        return this.request<T>(endpoint, options, false)
      }
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      const requestId = extractRequestId(errorPayload) || response.headers.get('x-request-id')
      const message = extractErrorMessage(errorPayload)

      const error = new Error(message || 'Request failed') as Error & {
        status?: number
        requestId?: string
      }
      error.status = response.status
      if (requestId) {
        error.requestId = requestId
      }

      throw error
    }

    if (response.status === 204) {
      return undefined as T
    }

    const rawBody = await response.text()
    if (!rawBody) {
      return undefined as T
    }

    return JSON.parse(rawBody) as T
  }
}

export const httpClient = new ApiHttpClient(API_BASE)
