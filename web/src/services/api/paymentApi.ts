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
    localStorage.setItem('esewa_billing', billing)
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

  verifyEsewa(encodedData: string, billing?: string): Promise<Record<string, unknown>> {
    const payload: { encodedData: string; billing?: string } = { encodedData }
    if (billing) {
      payload.billing = billing
    }

    return httpClient.request<Record<string, unknown>>('/payments/esewa/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
