import { httpClient } from './client'
import type { SuggestReplyOptions, SuggestReplyResponse } from './types'

export const aiApi = {
  suggestReply(
    customerMessage: string,
    tone?: string,
    forcedProduct?: string,
    options?: SuggestReplyOptions
  ): Promise<SuggestReplyResponse> {
    // SOURCE: dashboard picker passes forcedProduct/forcedProductId and context hints for the active conversation.
    // RISK: missing context fields can cause backend to fall back to ambiguous product inference.
    // PROTECTION: include explicit forced selection and follow-up flags whenever available.
    // RESULT: backend deterministic guards can lock replies to the seller-confirmed product.
    const body: Record<string, unknown> = { customerMessage }

    if (tone) body.tone = tone
    if (forcedProduct) body.forcedProduct = forcedProduct
    if (typeof options?.forcedProductId === 'number') {
      body.forcedProductId = options.forcedProductId
    }
    if (options?.source) body.source = options.source
    if (typeof options?.hasMedia === 'boolean') body.hasMedia = options.hasMedia
    if (options?.recentProducts?.length) body.recentProducts = options.recentProducts
    if (typeof options?.followUpContext === 'boolean') {
      body.followUpContext = options.followUpContext
    }

    return httpClient.request<SuggestReplyResponse>('/ai/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
