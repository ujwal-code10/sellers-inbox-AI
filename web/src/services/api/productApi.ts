import { httpClient } from './client'
import type { Product, Variant } from './types'

interface BulkVariantCreatePayload {
  color: string
  size: string
  available: boolean
}

export const productApi = {
  getProducts(): Promise<Product[]> {
    return httpClient.request<Product[]>('/products')
  },

  createProduct(
    name: string,
    price: number,
    keywords?: string,
    notes?: string
  ): Promise<Product> {
    return httpClient.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({ name, price, keywords, notes }),
    })
  },

  async deleteProduct(id: number): Promise<void> {
    await httpClient.request<{ success?: boolean; message?: string }>(`/products/${id}`, {
      method: 'DELETE',
    })
  },

  getVariants(productId: number): Promise<Variant[]> {
    return httpClient.request<Variant[]>(`/products/${productId}/variants`)
  },

  createVariant(
    productId: number,
    color: string,
    size: string,
    available: boolean = true
  ): Promise<Variant> {
    return httpClient.request<Variant>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify({ color, size, available }),
    })
  },

  createVariantsBulk(
    productId: number,
    variants: BulkVariantCreatePayload[]
  ): Promise<Variant[]> {
    return httpClient.request<Variant[]>(`/products/${productId}/variants/bulk`, {
      method: 'POST',
      body: JSON.stringify({ variants }),
    })
  },

  updateVariant(variantId: number, available: boolean): Promise<Variant> {
    return httpClient.request<Variant>(`/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    })
  },
}
