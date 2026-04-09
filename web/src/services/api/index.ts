import { aiApi } from './aiApi'
import { authApi } from './authApi'
import { deliveryApi } from './deliveryApi'
import { paymentApi } from './paymentApi'
import { productApi } from './productApi'

export * from './types'

export const api = {
  ...authApi,
  ...aiApi,
  ...productApi,
  ...deliveryApi,
  ...paymentApi,
}

function keepAlive() {
  void fetch('/api/health').catch(() => undefined)
}

if (typeof window !== 'undefined') {
  window.setInterval(keepAlive, 8 * 60 * 1000)
}
