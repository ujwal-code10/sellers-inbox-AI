import { aiApi } from './aiApi'
import { authApi } from './authApi'
import { deliveryApi } from './deliveryApi'
import { paymentApi } from './paymentApi'
import { productApi } from './productApi'

export * from './types'

// SOURCE: feature modules consume one merged API surface instead of many imports.
// RISK: fragmented clients can bypass shared HTTP behavior and drift on auth/csrf handling.
// PROTECTION: export a single composed api object built from domain modules.
// RESULT: consistent request behavior across all frontend features.
export const api = {
  ...authApi,
  ...aiApi,
  ...productApi,
  ...deliveryApi,
  ...paymentApi,
}

function keepAlive() {
  // SOURCE: serverless deployments may cold-start after inactivity.
  // RISK: first real user action can pay cold-start latency.
  // PROTECTION: lightweight periodic health ping to keep runtime warm.
  // RESULT: steadier perceived response time in active browser sessions.
  void fetch('/api/health').catch(() => undefined)
}

if (typeof window !== 'undefined') {
  window.setInterval(keepAlive, 8 * 60 * 1000)
}
