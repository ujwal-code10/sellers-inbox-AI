export interface User {
  id: number
  name: string
  email: string
  created_at?: string
}

export interface AuthResponse {
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
  version: number
}

export interface DeliveryZone {
  id: number
  name: string
  price: number
  cod_available: boolean
  created_at?: string
}

export type MessageSource = 'DM' | 'STORY_REPLY' | 'REEL_FORWARD'

export interface SuggestReplyDecision {
  action: 'ASK' | 'REPLY'
  reason: string
  productKnown: boolean
  matchedProduct?: string
  intent: string
  productCandidates?: string[]
}

export interface SuggestReplyOptions {
  source?: MessageSource
  hasMedia?: boolean
  recentProducts?: string[]
  forcedProductId?: number
  followUpContext?: boolean
}

export interface SuggestReplyResponse {
  suggestions: string[]
  decision: SuggestReplyDecision
}
