import { Copy06, Zap } from '@untitledui/icons'
import AppAlert from '../../components/ui/AppAlert'
import AppButton from '../../components/ui/AppButton'
import type { Product, SuggestReplyResponse } from '../../services/api/types'

interface DashboardReplyTabProps {
  customerMessage: string
  onCustomerMessageChange: (value: string) => void
  loading: boolean
  onGenerate: () => void
  onClear: () => void
  showClearButton: boolean
  onCopyOrderForm: () => void
  orderFormCopied: boolean
  error: string
  result: SuggestReplyResponse | null
  copiedIndex: number | null
  onCopySuggestion: (text: string, index: number) => void
  showProductPicker: boolean
  quickPickProducts: Product[]
  recentProductNames: string[]
  showProductSearch: boolean
  onEnableProductSearch: () => void
  productSearch: string
  onProductSearchChange: (value: string) => void
  browseProducts: Product[]
  productsCount: number
  onProductSelect: (product: Product) => void
  onCancelPicker: () => void
}

export default function DashboardReplyTab({
  customerMessage,
  onCustomerMessageChange,
  loading,
  onGenerate,
  onClear,
  showClearButton,
  onCopyOrderForm,
  orderFormCopied,
  error,
  result,
  copiedIndex,
  onCopySuggestion,
  showProductPicker,
  quickPickProducts,
  recentProductNames,
  showProductSearch,
  onEnableProductSearch,
  productSearch,
  onProductSearchChange,
  browseProducts,
  productsCount,
  onProductSelect,
  onCancelPicker,
}: DashboardReplyTabProps) {
  const showDecisionDebugInfo =
    import.meta.env.DEV || import.meta.env.VITE_SHOW_DECISION_DEBUG === 'true'

  return (
    <section className="dashboard-tab-wrap dashboard-tab-wrap-reply">
      <div className="reply-generator">
        <div className="input-section">
          <label htmlFor="customerMessage">Customer Message</label>
          <textarea
            id="customerMessage"
            value={customerMessage}
            onChange={(event) => onCustomerMessageChange(event.target.value)}
            placeholder="Paste customer message here...&#10;&#10;Example: Blue hoodie cha? Price kati ho?"
            rows={4}
          />
          <div className="button-row">
            <AppButton
              onClick={onGenerate}
              className="btn-generate-modern"
              loading={loading}
              loadingText="Generating..."
              fullWidth
              leftIcon={<Zap className="app-icon-sm" />}
            >
              Generate Reply
            </AppButton>
            {showClearButton ? (
              <AppButton onClick={onClear} className="btn-clear-modern" variant="secondary">
                Clear
              </AppButton>
            ) : null}
          </div>
          <div className="reply-order-form-wrap">
            <AppButton
              onClick={onCopyOrderForm}
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Copy06 className="app-icon-sm" />}
            >
              {orderFormCopied ? '✓ Copied!' : 'Copy order form'}
            </AppButton>
          </div>
        </div>

        {error ? (
          <AppAlert type="error" title="Could not generate reply">
            {error}
          </AppAlert>
        ) : null}

        {result ? (
          <div className="results-section">
            <div className={`action-badge ${result.decision.action.toLowerCase()}`}>
              {result.decision.action === 'ASK'
                ? '❓ Clarification Needed'
                : '✅ Reply Suggestions'
              }
            </div>
            <div className="suggestions-list">
              {result.suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <p className="suggestion-text">{suggestion}</p>
                  <AppButton
                    onClick={() => onCopySuggestion(suggestion, index)}
                    className="suggestion-copy-btn"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Copy06 className="app-icon-sm" />}
                  >
                    {copiedIndex === index ? '✓ Copied!' : '📋 Copy'}
                  </AppButton>
                </div>
              ))}
            </div>

            {showProductPicker ? (
              <div className="product-picker">
                <div className="product-picker-title">
                  💡 Pick a product with one tap:
                </div>

                {quickPickProducts.length > 0 ? (
                  <>
                    <div className="product-picker-subtitle">Quick picks</div>
                    <div className="product-picker-caption">
                      Based on stock-ready products and your recent choices.
                    </div>
                    <div className="product-chip-grid">
                      {quickPickProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => onProductSelect(product)}
                          className="product-chip-btn"
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {recentProductNames.length > 0 ? (
                  <div className="product-picker-recent">
                    Recent picks: {recentProductNames.join(' • ')}
                  </div>
                ) : null}

                {!showProductSearch && productsCount > 0 ? (
                  <AppButton
                    onClick={onEnableProductSearch}
                    variant="secondary"
                    size="sm"
                    className="product-picker-search-toggle"
                  >
                    Can&apos;t find it? Search products
                  </AppButton>
                ) : null}

                {showProductSearch ? (
                  <>
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearch}
                      onChange={(event) => onProductSearchChange(event.target.value)}
                      className="product-picker-search"
                    />

                    {browseProducts.length > 0 ? (
                      <div className="product-chip-grid">
                        {browseProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => onProductSelect(product)}
                            className="product-chip-btn"
                          >
                            {product.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="product-picker-empty">
                        {productSearch
                          ? 'No products found matching your search.'
                          : 'No additional products to show right now.'}
                      </div>
                    )}
                  </>
                ) : null}

                {productsCount === 0 ? (
                  <div className="product-picker-empty">
                    Add at least a few top products to unlock quick replies.
                  </div>
                ) : null}

                <AppButton
                  onClick={onCancelPicker}
                  variant="secondary"
                  size="sm"
                  className="product-picker-cancel"
                >
                  Cancel
                </AppButton>
              </div>
            ) : null}

            {showDecisionDebugInfo &&
            result.decision.action === 'REPLY' &&
            result.decision.matchedProduct ? (
              <div className="debug-info">
                <span>Product: {result.decision.matchedProduct}</span>
                <span>Intent: {result.decision.intent}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
