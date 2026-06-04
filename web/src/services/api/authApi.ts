import { httpClient } from './client'
import type {
  AuthResponse,
  ForgotPasswordResponse,
  MeResponse,
} from './types'

// SOURCE: seller auth state is server-managed through HttpOnly cookies.
// RISK: frontend token storage assumptions can drift from backend cookie-session model.
// PROTECTION: all auth calls go through shared httpClient with credentials + CSRF behavior.
// RESULT: auth API usage stays aligned with backend session hardening.
export const authApi = {
  signup(name: string, email: string, password: string): Promise<AuthResponse> {
    return httpClient.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return httpClient.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    return httpClient.request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async logout(): Promise<void> {
    await httpClient.request<{ message?: string }>('/auth/logout', {
      method: 'POST',
    })
  },

  getMe(): Promise<MeResponse> {
    return httpClient.request<MeResponse>('/auth/me')
  },

  updateMeName(name: string): Promise<MeResponse> {
    return httpClient.request<MeResponse>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  },
}
