import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, Product } from '../services/api'
import Products from './Products'
import DeliveryZones from './DeliveryZones'

interface ReplyResult {
  suggestions: string[]
  decision: {
    action: 'ASK' | 'REPLY'
    reason: string
    productKnown: boolean
    matchedProduct?: string
    intent: string
  }
}

type Tab = 'reply' | 'products' | 'delivery'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('reply')
  const [customerMessage, setCustomerMessage] = useState('')
  const [result, setResult] = useState<ReplyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [orderFormCopied, setOrderFormCopied] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallReason, setPaywallReason] = useState<'replies' | 'products'>('replies')

  // Product picker state
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  // Load products when reply tab is active
  useEffect(() => {
    if (activeTab === 'reply' && products.length === 0 && !productsLoading) {
      loadProducts()
    }
  }, [activeTab])

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const productsData = await api.getProducts()
      setProducts(productsData)
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setProductsLoading(false)
    }
  }

  // Filter products based on search, sort alphabetically, limit to 8
  const filteredProducts = products
    .filter(product =>
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.keywords && product.keywords.toLowerCase().includes(productSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8)

  const handleProductSelect = async (productName: string) => {
    if (!customerMessage.trim()) return

    setError('')
    setLoading(true)
    setShowProductPicker(false)
    setProductSearch('')

    try {
      const response = await api.suggestReply(customerMessage.trim(), undefined, productName)
      setResult(response)
    } catch (err: any) {
      if (err.message === 'Daily limit reached') {
        setPaywallReason('replies')
        setShowPaywall(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to generate reply')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!customerMessage.trim()) {
      setError('Please paste a customer message')
      return
    }

    setError('')
    setLoading(true)
    setResult(null)
    setShowProductPicker(false)

    try {
      const response = await api.suggestReply(customerMessage.trim())
      setResult(response)
      // Show product picker if AI asks for clarification and products are available
      if (response.decision.action === 'ASK' && products.length > 0) {
        setShowProductPicker(true)
      }
    } catch (err: any) {
      // Check if this is a paywall error
      if (err.message === 'Daily limit reached') {
        setPaywallReason('replies')
        setShowPaywall(true)
        return
      }
      if (err.message === 'Product limit reached') {
        setPaywallReason('products')
        setShowPaywall(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to generate reply')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const handleClear = () => {
    setCustomerMessage('')
    setResult(null)
    setError('')
    setShowProductPicker(false)
    setProductSearch('')
  }

  const handleCopyOrderForm = async () => {
    const orderFormText = `Order details dinuhos 😊

Full name:
Contact number:
Location/Address:`

    try {
      await navigator.clipboard.writeText(orderFormText)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = orderFormText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }

    setOrderFormCopied(true)
    setTimeout(() => setOrderFormCopied(false), 2000)
  }

  return (
    <div className="dashboard">

      {/* ── Paywall Modal ── */}
      {showPaywall && (
        <div
          className="modal-overlay"
          onClick={() => setShowPaywall(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ textAlign: 'center', padding: '2rem' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <h3 style={{ marginBottom: 8 }}>
              {paywallReason === 'replies'
                ? "You've used all 20 free replies today"
                : "You've reached the 5 product limit"
              }
            </h3>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
              {paywallReason === 'replies'
                ? 'Upgrade to Pro for unlimited replies every day'
                : 'Upgrade to Pro for unlimited products'
              }
            </p>
            <button
              onClick={() => navigate('/upgrade')}
              style={{
                width: '100%', padding: '12px 0',
                borderRadius: 10, border: 'none',
                background: '#1D9E75', color: '#fff',
                fontWeight: 700, fontSize: 15,
                cursor: 'pointer', marginBottom: 10
              }}
            >
              Upgrade to Pro — Rs. 299/month
            </button>
            <button
              onClick={() => setShowPaywall(false)}
              style={{
                width: '100%', padding: '10px 0',
                borderRadius: 10, border: '0.5px solid #e5e5e5',
                background: 'transparent', color: '#888',
                fontSize: 14, cursor: 'pointer'
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <h1>Seller Inbox AI</h1>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          <button
            onClick={() => navigate('/upgrade')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1.5px solid #1D9E75',
              background: 'transparent',
              color: '#1D9E75',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              marginRight: 8
            }}
          >
            ⚡ Upgrade
          </button>
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'reply' ? 'active' : ''}`}
          onClick={() => setActiveTab('reply')}
        >
          💬 Reply
        </button>
        <button
          className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
           Products
        </button>
        <button
          className={`tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivery')}
        >
           Delivery
        </button>
      </nav>

      <main className="dashboard-main">
        {/* Reply Tab */}
        {activeTab === 'reply' && (
          <div className="reply-generator">
            <div className="input-section">
              <label htmlFor="customerMessage">Customer Message</label>
              <textarea
                id="customerMessage"
                value={customerMessage}
                onChange={(e) => {
                  setCustomerMessage(e.target.value)
                  setShowProductPicker(false)
                }}
                placeholder="Paste customer message here...&#10;&#10;Example: Blue hoodie cha? Price kati ho?"
                rows={4}
              />
              <div className="button-row">
                <button
                  onClick={handleGenerate}
                  className="btn-generate"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : '✨ Generate Reply'}
                </button>
                {(customerMessage || result) && (
                  <button onClick={handleClear} className="btn-clear">
                    Clear
                  </button>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={handleCopyOrderForm}
                  type="button"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  {orderFormCopied ? '✓ Copied!' : 'Copy order form'}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {result && (
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
                      <button
                        onClick={() => handleCopy(suggestion, index)}
                        className="btn-copy"
                      >
                        {copiedIndex === index ? '✓ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Product Picker - shows when AI asks for clarification */}
                {showProductPicker && (
                  <div style={{
                    background: '#f9f9f9',
                    border: '1px solid #e5e5e5',
                    borderRadius: 12,
                    padding: 16,
                    marginTop: 12
                  }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#333',
                      marginBottom: 12
                    }}>
                      💡 Select the product you're asking about:
                    </div>

                    {/* Search input */}
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        fontSize: 14,
                        marginBottom: 12
                      }}
                    />

                    {/* Product chips */}
                    {filteredProducts.length > 0 ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 8
                      }}>
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => handleProductSelect(product.name)}
                            style={{
                              padding: '10px 12px',
                              backgroundColor: '#1D9E75',
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#22c48e'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#1D9E75'
                            }}
                          >
                            {product.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        color: '#666',
                        fontSize: 14,
                        padding: 20
                      }}>
                        {productSearch ? 'No products found matching your search.' : 'Add products first to use this feature.'}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowProductPicker(false)
                        setProductSearch('')
                      }}
                      style={{
                        marginTop: 12,
                        padding: '6px 12px',
                        background: 'transparent',
                        color: '#666',
                        border: '1px solid #ddd',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {result.decision.action === 'REPLY' && result.decision.matchedProduct && (
                  <div className="debug-info">
                    <span>Product: {result.decision.matchedProduct}</span>
                    <span>Intent: {result.decision.intent}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && <Products />}
        {activeTab === 'delivery' && <DeliveryZones />}
      </main>
    </div>
  )
}