import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
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
  const [activeTab, setActiveTab] = useState<Tab>('reply')
  const [customerMessage, setCustomerMessage] = useState('')
  const [result, setResult] = useState<ReplyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!customerMessage.trim()) {
      setError('Please paste a customer message')
      return
    }

    setError('')
    setLoading(true)
    setResult(null)

    try {
      const response = await api.suggestReply(customerMessage.trim())
      setResult(response)
    } catch (err) {
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
      // Fallback for older browsers
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
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Seller Inbox AI</h1>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
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
          📦 Products
        </button>
        <button 
          className={`tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivery')}
        >
          🚚 Delivery
        </button>
      </nav>

      <main className="dashboard-main">
        {/* Reply Tab */}
        {activeTab === 'reply' && (
          <div className="reply-generator">
            {/* Input Section */}
            <div className="input-section">
              <label htmlFor="customerMessage">Customer Message</label>
              <textarea
                id="customerMessage"
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
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
            </div>

            {/* Error */}
            {error && <div className="error-message">{error}</div>}

            {/* Results Section */}
            {result && (
              <div className="results-section">
                {/* Action Badge */}
                <div className={`action-badge ${result.decision.action.toLowerCase()}`}>
                  {result.decision.action === 'ASK' ? '❓ Clarification Needed' : '✅ Reply Suggestions'}
                </div>

                {/* Suggestions */}
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

                {/* Debug Info */}
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

        {/* Products Tab */}
        {activeTab === 'products' && <Products />}

        {/* Delivery Tab */}
        {activeTab === 'delivery' && <DeliveryZones />}
      </main>
    </div>
  )
}
