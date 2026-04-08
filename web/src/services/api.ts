const API_BASE = '/api'

export interface User {
  id: number
  name: string
  email: string
  created_at?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface MeResponse {
  user: User
}

export interface ForgotPasswordResponse {
  message: string
}

export interface PlanResponse {
  current: {
    plan: 'free' | 'pro'
    billing: 'monthly' | 'yearly' | null
    status: string
    expires_at: string | null
  }
  usage: {
    replies_today: number
    replies_limit: number | null
    products: number
    products_limit: number | null
  }
  plans: {
    free: {
      price: number
      replies_per_day: number
      products: number
      mode?: 'trust' | 'enforced'
    }
    pro_monthly: { price: number; replies_per_day: null; products: null }
    pro_yearly: { price: number; replies_per_day: null; products: null }
  }
}

export type BillingCycle = 'monthly' | 'yearly'

export interface ManualQrConfigResponse {
  enabled: boolean
  qr_image_url: string | null
  receiver_name: string
  receiver_id: string
  support_text: string
  amounts: {
    monthly: number
    yearly: number
  }
}

export interface ManualQrSubmitResponse {
  success: boolean
  status: 'pending_review'
  transaction_id: number
  amount: number
  submitted_at?: string
  requires_admin_approval?: boolean
  access_activated?: boolean
  message: string
}

export interface ManualQrStatusResponse {
  pending: boolean
  request?: {
    transaction_id: number
    amount: number
    payment_reference: string
    billing: BillingCycle
    payer_name?: string | null
    note?: string | null
    submitted_at: string
  }
}

export interface Product {
  id: number
  name: string
  price: number
  variants?: Variant[]
  keywords?: string | null
  notes?: string | null
}

export interface Variant {
  id: number
  product_id: number
  color: string
  size: string
  available: boolean
}

export interface DeliveryZone {
  id: number
  name: string
  price: number
  cod_available: boolean
  created_at?: string
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth endpoints
  async signup(name: string, email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    return this.request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/auth/me')
  }

  async updateMeName(name: string): Promise<MeResponse> {
    return this.request<MeResponse>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }

  // AI endpoint
  async suggestReply(
    customerMessage: string,
    tone?: string,
    forcedProduct?: string
  ): Promise<{ suggestions: string[]; decision: any }> {
    const body: any = { customerMessage }
    if (tone) body.tone = tone
    if (forcedProduct) body.forcedProduct = forcedProduct

    return this.request('/ai/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  // Products endpoints
  async getProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products')
  }

  async createProduct(
    name: string,
    price: number,
    keywords?: string,
    notes?: string
  ): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({ name, price, keywords, notes }),
    })
  }

  async deleteProduct(id: number): Promise<void> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    })
  }

  // Variants endpoints
  async getVariants(productId: number): Promise<Variant[]> {
    return this.request<Variant[]>(`/products/${productId}/variants`)
  }

  async createVariant(
    productId: number,
    color: string,
    size: string,
    available: boolean = true
  ): Promise<Variant> {
    return this.request<Variant>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify({ color, size, available }),
    })
  }

  async updateVariant(variantId: number, available: boolean): Promise<Variant> {
    return this.request<Variant>(`/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    })
  }

  // Delivery zones endpoints
  async getDeliveryZones(): Promise<DeliveryZone[]> {
    return this.request<DeliveryZone[]>('/delivery-zones')
  }

  async createDeliveryZone(
    name: string,
    price: number,
    codAvailable: boolean = true
  ): Promise<DeliveryZone> {
    return this.request<DeliveryZone>('/delivery-zones', {
      method: 'POST',
      body: JSON.stringify({ name, price, codAvailable }),
    })
  }

  async updateDeliveryZone(
    id: number,
    name: string,
    price: number,
    codAvailable: boolean
  ): Promise<DeliveryZone> {
    return this.request<DeliveryZone>(`/delivery-zones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, price, codAvailable }),
    })
  }

  async deleteDeliveryZone(id: number): Promise<void> {
    return this.request(`/delivery-zones/${id}`, {
      method: 'DELETE',
    })
  }

  // Payment endpoints
  async getPlans(): Promise<PlanResponse> {
    return this.request<PlanResponse>('/payments/plans')
  }

  async initiateEsewa(billing: 'monthly' | 'yearly'): Promise<any> {
    localStorage.setItem('esewa_billing', billing)
    return this.request('/payments/esewa/initiate', {
      method: 'POST',
      body: JSON.stringify({ billing }),
    })
  }

  async getManualQrConfig(): Promise<ManualQrConfigResponse> {
    return this.request<ManualQrConfigResponse>('/payments/manual-qr/config')
  }

  async getManualQrStatus(): Promise<ManualQrStatusResponse> {
    return this.request<ManualQrStatusResponse>('/payments/manual-qr/status')
  }

  async submitManualQrPayment(payload: {
    billing: BillingCycle
    paymentReference: string
    payerName?: string
    note?: string
  }): Promise<ManualQrSubmitResponse> {
    return this.request<ManualQrSubmitResponse>('/payments/manual-qr/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async verifyEsewa(encodedData: string, billing?: string): Promise<any> {
    const payload: Record<string, string> = { encodedData }
    if (billing) payload.billing = billing

    return this.request('/payments/esewa/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}

export const api = new ApiClient()

// Keep Vercel function warm
// Ping every 8 minutes to prevent cold start
const keepAlive = () => {
  fetch('/api/health').catch(() => {})
}

// Start pinging when app loads
if (typeof window !== 'undefined') {
  setInterval(keepAlive, 8 * 60 * 1000)
}