import { httpClient } from './client'
import type {
  AuthResponse,
  ForgotPasswordResponse,
  MeResponse,
} from './types'

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
