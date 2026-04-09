const API_BASE = '/api'

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.length > 0 ? maybeError : null
}

export class ApiHttpClient {
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
    try {
      const response = await fetch(`${this.base}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      return response.ok
    } catch {
      return false
    }
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
      const message = extractErrorMessage(errorPayload)
      throw new Error(message || 'Request failed')
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
