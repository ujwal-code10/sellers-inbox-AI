import { httpClient } from './client'
import type {
  BillingCycle,
  ManualQrConfigResponse,
  ManualQrStatusResponse,
  ManualQrSubmitResponse,
  PlanResponse,
} from './types'

export const paymentApi = {
  getPlans(): Promise<PlanResponse> {
    return httpClient.request<PlanResponse>('/payments/plans')
  },

  initiateEsewa(billing: BillingCycle): Promise<Record<string, unknown>> {
    return httpClient.request<Record<string, unknown>>('/payments/esewa/initiate', {
      method: 'POST',
      body: JSON.stringify({ billing }),
    })
  },

  getManualQrConfig(): Promise<ManualQrConfigResponse> {
    return httpClient.request<ManualQrConfigResponse>('/payments/manual-qr/config')
  },

  getManualQrStatus(): Promise<ManualQrStatusResponse> {
    return httpClient.request<ManualQrStatusResponse>('/payments/manual-qr/status')
  },

  submitManualQrPayment(payload: {
    billing: BillingCycle
    paymentReference: string
    payerName?: string
    note?: string
  }): Promise<ManualQrSubmitResponse> {
    return httpClient.request<ManualQrSubmitResponse>('/payments/manual-qr/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  verifyEsewa(encodedData: string): Promise<Record<string, unknown>> {
    // SOURCE: encodedData is returned by eSewa redirect and signed server-verifiable fields.
    // RISK: sending client billing hints can diverge from transaction UUID truth.
    // PROTECTION: send encodedData only; backend derives billing and validates signature/provider status.
    // RESULT: payment upgrade path remains server-authoritative.
    return httpClient.request<Record<string, unknown>>('/payments/esewa/verify', {
      method: 'POST',
      body: JSON.stringify({ encodedData }),
    })
  },
}
