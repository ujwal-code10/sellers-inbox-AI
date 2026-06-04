import { httpClient } from './client'
import type { DeliveryZone } from './types'

export const deliveryApi = {
  getDeliveryZones(): Promise<DeliveryZone[]> {
    return httpClient.request<DeliveryZone[]>('/delivery-zones')
  },

  createDeliveryZone(
    name: string,
    price: number,
    codAvailable: boolean = true
  ): Promise<DeliveryZone> {
    return httpClient.request<DeliveryZone>('/delivery-zones', {
      method: 'POST',
      body: JSON.stringify({ name, price, codAvailable }),
    })
  },

  updateDeliveryZone(
    id: number,
    name: string,
    price: number,
    codAvailable: boolean
  ): Promise<DeliveryZone> {
    // SOURCE: delivery zone edits come from seller-owned shipping settings UI.
    // RISK: malformed updates can break delivery quotes used in reply generation.
    // PROTECTION: send explicit full zone payload and rely on backend schema validation.
    // RESULT: delivery pricing/COD state stays consistent for downstream AI context.
    return httpClient.request<DeliveryZone>(`/delivery-zones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, price, codAvailable }),
    })
  },

  async deleteDeliveryZone(id: number): Promise<void> {
    await httpClient.request<{ success?: boolean; message?: string }>(`/delivery-zones/${id}`, {
      method: 'DELETE',
    })
  },
}
