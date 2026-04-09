import { httpClient } from './client'
import type { SuggestReplyOptions, SuggestReplyResponse } from './types'

export const aiApi = {
  suggestReply(
    customerMessage: string,
    tone?: string,
    forcedProduct?: string,
    options?: SuggestReplyOptions
  ): Promise<SuggestReplyResponse> {
    const body: Record<string, unknown> = { customerMessage }

    if (tone) body.tone = tone
    if (forcedProduct) body.forcedProduct = forcedProduct
    if (typeof options?.forcedProductId === 'number') {
      body.forcedProductId = options.forcedProductId
    }
    if (options?.source) body.source = options.source
    if (typeof options?.hasMedia === 'boolean') body.hasMedia = options.hasMedia
    if (options?.recentProducts?.length) body.recentProducts = options.recentProducts

    return httpClient.request<SuggestReplyResponse>('/ai/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
