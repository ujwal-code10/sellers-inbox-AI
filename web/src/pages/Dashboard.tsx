import { useState, useEffect, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUIFeedback } from '../context/UIFeedbackContext'
import {
  Copy06,
  CreditCard01,
  Edit03,
  LogOut01,
  MarkerPin02,
  MessageChatCircle,
  Package,
  User01,
  Zap,
} from '@untitledui/icons'
import { api, Product, PlanResponse } from '../services/api'
import AppAlert from '../components/ui/AppAlert'
import AppButton from '../components/ui/AppButton'
import Products from './Products'
import DeliveryZones from './DeliveryZones'
import Upgrade from './Upgrade'

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

type Tab = 'reply' | 'products' | 'delivery' | 'payment' | 'profile'

interface DashboardNavItem {
  key: Tab
  label: string
  note: string
  icon: ComponentType<{ className?: string }>
}

const dashboardNavItems: DashboardNavItem[] = [
  {
    key: 'reply',
    label: 'Reply',
    note: 'Generate smart response suggestions',
    icon: MessageChatCircle,
  },
  {
    key: 'products',
    label: 'Products',
    note: 'Manage catalog and variants',
    icon: Package,
  },
  {
    key: 'delivery',
    label: 'Delivery',
    note: 'Configure zones and COD rules',
    icon: MarkerPin02,
  },
  {
    key: 'payment',
    label: 'Payment',
    note: 'Upgrade plan and billing',
    icon: CreditCard01,
  },
  {
    key: 'profile',
    label: 'Profile',
    note: 'Account details and usage',
    icon: User01,
  },
]

const tabHeadings: Record<Tab, { title: string; description: string }> = {
  reply: {
    title: 'AI Reply Workspace',
    description: 'Paste customer chats and get polished, context-aware replies in seconds.',
  },
  products: {
    title: 'Product Catalog',
    description: 'Keep products and variants updated so replies stay accurate.',
  },
  delivery: {
    title: 'Delivery Settings',
    description: 'Set up delivery zones and COD options for cleaner operations.',
  },
  payment: {
    title: 'Billing & Plan',
    description: 'Manage your subscription and unlock unlimited usage.',
  },
  profile: {
    title: 'Profile',
    description: 'Manage your account details, plan usage, and actions.',
  },
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)
    return copied
  }
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { notify } = useUIFeedback()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('reply')
  const [profileName, setProfileName] = useState(user?.name ?? '')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [planData, setPlanData] = useState<PlanResponse | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
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

  useEffect(() => {
    const nextName = user?.name ?? ''
    setProfileName(nextName)
    if (!editingName) {
      setNameDraft(nextName)
    }
  }, [user?.name, editingName])

  useEffect(() => {
    if (activeTab === 'profile') {
      loadPlanData()
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

  const loadPlanData = async () => {
    setPlanLoading(true)
    try {
      const data = await api.getPlans()
      setPlanData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plan details'
      notify({ type: 'error', title: 'Could not load plan details', message })
    } finally {
      setPlanLoading(false)
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
      notify({
        type: 'success',
        title: 'Reply refreshed with selected product',
        message: productName,
      })
    } catch (err: any) {
      if (err.message === 'Daily limit reached') {
        setPaywallReason('replies')
        setShowPaywall(true)
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to generate reply'
      setError(message)
      notify({ type: 'error', title: 'Could not generate reply', message })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!customerMessage.trim()) {
      setError('Please paste a customer message')
      notify({
        type: 'warning',
        title: 'Message required',
        message: 'Paste a customer message to generate suggestions.',
      })
      return
    }

    setError('')
    setLoading(true)
    setResult(null)
    setShowProductPicker(false)

    try {
      const response = await api.suggestReply(customerMessage.trim())
      setResult(response)
      // Show product picker if AI asks for clarification
      if (response.decision.action === 'ASK') {
        // Refetch products to ensure we have the latest list
        await loadProducts()
        setShowProductPicker(true)
        notify({
          type: 'info',
          title: 'More context needed',
          message: 'Select a product so the reply can be more accurate.',
        })
      } else {
        notify({
          type: 'success',
          title: 'Reply suggestions generated',
          message: 'You can copy any suggestion below.',
        })
      }
    } catch (err: any) {
      // Check if this is a paywall error
      if (err.message === 'Daily limit reached') {
        setPaywallReason('replies')
        setShowPaywall(true)
        notify({
          type: 'info',
          title: 'Daily free reply limit reached',
          message: 'Upgrade to continue with unlimited replies.',
        })
        return
      }
      if (err.message === 'Product limit reached') {
        setPaywallReason('products')
        setShowPaywall(true)
        notify({
          type: 'info',
          title: 'Free product limit reached',
          message: 'Upgrade to add more products.',
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to generate reply'
      setError(message)
      notify({ type: 'error', title: 'Could not generate reply', message })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, index: number) => {
    const copied = await copyToClipboard(text)
    if (copied) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
      notify({ type: 'success', title: 'Copied to clipboard' })
    } else {
      notify({ type: 'error', title: 'Copy failed', message: 'Please try again.' })
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

    const copied = await copyToClipboard(orderFormText)

    if (copied) {
      setOrderFormCopied(true)
      notify({ type: 'success', title: 'Order form copied' })
      setTimeout(() => setOrderFormCopied(false), 2000)
      return
    }

    notify({ type: 'error', title: 'Copy failed', message: 'Please copy manually.' })
  }

  const handleSaveName = async () => {
    const nextName = nameDraft.trim()

    if (!nextName) {
      notify({ type: 'warning', title: 'Name required', message: 'Enter your name before saving.' })
      return
    }

    if (nextName.length > 100) {
      notify({ type: 'warning', title: 'Name too long', message: 'Name must be at most 100 characters.' })
      return
    }

    setSavingName(true)
    try {
      const response = await api.updateMeName(nextName)
      setProfileName(response.user.name)
      setNameDraft(response.user.name)
      setEditingName(false)
      notify({ type: 'success', title: 'Profile updated', message: 'Name saved successfully.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile name'
      notify({ type: 'error', title: 'Could not update name', message })
    } finally {
      setSavingName(false)
    }
  }

  const repliesToday = planData?.usage.replies_today ?? 0
  const repliesLimit = planData?.usage.replies_limit
  const repliesProgressPercent = repliesLimit
    ? Math.min(100, Math.round((repliesToday / repliesLimit) * 100))
    : 100

  const repliesProgressColor = repliesProgressPercent > 95
    ? '#dc2626'
    : repliesProgressPercent >= 80
      ? '#d97706'
      : '#1d9e75'

  const proExpiryLabel = planData?.current.expires_at
    ? new Date(planData.current.expires_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    : 'Active'

  return (
    <div className="dashboard">
      {/* ── Paywall Modal ── */}
      {showPaywall && (
        <div
          className="modal-overlay"
          onClick={() => setShowPaywall(false)}
        >
          <div
            className="modal paywall-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="paywall-icon"><Zap className="paywall-icon-svg" /></div>
            <h3 className="paywall-title">
              {paywallReason === 'replies'
                ? "You've used all 20 free replies today"
                : "You've reached the 5 product limit"
              }
            </h3>
            <p className="paywall-message">
              {paywallReason === 'replies'
                ? 'Upgrade to Pro for unlimited replies every day'
                : 'Upgrade to Pro for unlimited products'
              }
            </p>
            <AppButton
              onClick={() => navigate('/upgrade')}
              variant="primary"
              size="lg"
              fullWidth
              className="paywall-upgrade-btn"
            >
              Upgrade to Pro — Rs. 299/month
            </AppButton>
            <AppButton
              onClick={() => setShowPaywall(false)}
              variant="secondary"
              fullWidth
            >
              Maybe later
            </AppButton>
          </div>
        </div>
      )}

      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              <Zap className="sidebar-brand-icon" />
            </div>
            <div>
              <p className="sidebar-brand-kicker">Seller Workspace</p>
              <h1>Inbox AI</h1>
            </div>
          </div>

          <p className="sidebar-section-label">Main</p>
          <nav className="sidebar-nav" aria-label="Dashboard navigation">
            {dashboardNavItems.map((item, index) => {
              const Icon = item.icon
              const isActive = activeTab === item.key

              return (
                <button
                  key={item.key}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                  style={{ animationDelay: `${0.06 * index}s` }}
                >
                  <Icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-copy">
                    <span className="sidebar-nav-label">{item.label}</span>
                    <span className="sidebar-nav-note">{item.note}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <p className="sidebar-section-label">Account</p>
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-upgrade"
              onClick={() => setActiveTab('payment')}
            >
              <Zap className="sidebar-upgrade-icon" />
              <span>
                <strong>Upgrade to Pro</strong>
                <small>Unlimited replies and products</small>
              </span>
            </button>

            <div className="sidebar-profile">
              <div className="sidebar-profile-avatar">
                <User01 className="sidebar-profile-icon" />
              </div>
              <div className="sidebar-profile-copy">
                <span className="sidebar-profile-name">{profileName || 'Seller'}</span>
                <span className="sidebar-profile-email">{user?.email ?? 'seller@inbox-ai.app'}</span>
              </div>
            </div>

            <AppButton
              onClick={logout}
              className="sidebar-logout-btn"
              variant="secondary"
              size="sm"
              fullWidth
              leftIcon={<LogOut01 className="app-icon-sm" />}
            >
              Logout
            </AppButton>
          </div>
        </aside>

        <section className="dashboard-content">
          <div className="dashboard-content-head">
            <div>
              <p className="dashboard-content-kicker">Seller Inbox AI</p>
              <h2>{tabHeadings[activeTab].title}</h2>
              <p>{tabHeadings[activeTab].description}</p>
            </div>
            <div className="dashboard-content-actions">
              <AppButton
                onClick={() => setActiveTab('payment')}
                variant="pill"
                size="sm"
                leftIcon={<Zap className="app-icon-sm" />}
              >
                Upgrade
              </AppButton>
              <AppButton
                onClick={logout}
                className="dashboard-mobile-logout"
                variant="danger"
                size="sm"
                leftIcon={<LogOut01 className="app-icon-sm" />}
              >
                Logout
              </AppButton>
            </div>
          </div>

          <main className="dashboard-main">
            {/* Reply Tab */}
            {activeTab === 'reply' && (
              <section className="dashboard-tab-wrap dashboard-tab-wrap-reply">
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
                      <AppButton
                        onClick={handleGenerate}
                        className="btn-generate-modern"
                        loading={loading}
                        loadingText="Generating..."
                        fullWidth
                        leftIcon={<Zap className="app-icon-sm" />}
                      >
                        Generate Reply
                      </AppButton>
                      {(customerMessage || result) && (
                        <AppButton onClick={handleClear} className="btn-clear-modern" variant="secondary">
                          Clear
                        </AppButton>
                      )}
                    </div>
                    <div className="reply-order-form-wrap">
                      <AppButton
                        onClick={handleCopyOrderForm}
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
                            <AppButton
                              onClick={() => handleCopy(suggestion, index)}
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

                      {/* Product Picker - shows when AI asks for clarification */}
                      {showProductPicker && (
                        <div className="product-picker">
                          <div className="product-picker-title">
                            💡 Select the product you're asking about:
                          </div>

                          {/* Search input */}
                          <input
                            type="text"
                            placeholder="Search product..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="product-picker-search"
                          />

                          {/* Product chips */}
                          {filteredProducts.length > 0 ? (
                            <div className="product-chip-grid">
                              {filteredProducts.map((product) => (
                                <button
                                  key={product.id}
                                  onClick={() => handleProductSelect(product.name)}
                                  className="product-chip-btn"
                                >
                                  {product.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="product-picker-empty">
                              {productSearch ? 'No products found matching your search.' : 'Add products first to use this feature.'}
                            </div>
                          )}

                          <AppButton
                            onClick={() => {
                              setShowProductPicker(false)
                              setProductSearch('')
                            }}
                            variant="secondary"
                            size="sm"
                            className="product-picker-cancel"
                          >
                            Cancel
                          </AppButton>
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
              </section>
            )}

            {activeTab === 'products' && (
              <section className="dashboard-tab-wrap">
                <div className="dashboard-tab-surface">
                  <Products />
                </div>
              </section>
            )}
            {activeTab === 'delivery' && (
              <section className="dashboard-tab-wrap">
                <div className="dashboard-tab-surface">
                  <DeliveryZones />
                </div>
              </section>
            )}
            {activeTab === 'payment' && (
              <section className="dashboard-tab-wrap">
                <div className="payment-tab-wrap">
                  <Upgrade />
                </div>
              </section>
            )}
            {activeTab === 'profile' && (
              <section className="dashboard-tab-wrap">
                <div className="profile-layout">
                  <section className="profile-card">
                    <p className="profile-card-title">👤 Account</p>

                    <div className="profile-row">
                      <span className="profile-label">Name</span>
                      
                      
                    {editingName ? (
                      <div className="profile-name-editor">
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="profile-name-input"
                          aria-label="Edit account name"
                        />
                        <AppButton
                          onClick={handleSaveName}
                          size="sm"
                          loading={savingName}
                          loadingText="Saving..."
                        >
                          Save
                        </AppButton>
                        <AppButton
                          onClick={() => {
                            setNameDraft(profileName)
                            setEditingName(false)
                          }}
                          size="sm"
                          variant="secondary"
                        >
                          Cancel
                        </AppButton>
                      </div>
                    ) : (
                      <div className="profile-name-view">
                        <span className="profile-value">{profileName || 'Seller'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNameDraft(profileName)
                            setEditingName(true)
                          }}
                          className="profile-edit-btn"
                          aria-label="Edit name"
                        >
                          <Edit03 className="app-icon-sm" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="profile-row profile-row-last">
                    <span className="profile-label">Email</span>
                    <span className="profile-value">{user?.email ?? 'No email found'}</span>
                  </div>
                  </section>

                  <section className="profile-card">
                    <p className="profile-card-title">⚡ Your Plan</p>

                  {planLoading ? (
                    <div className="profile-plan-empty">Loading plan details...</div>
                  ) : !planData ? (
                    <div className="profile-plan-empty-wrap">
                      <div className="profile-plan-empty">
                        Plan details are unavailable right now.
                      </div>
                      <AppButton onClick={loadPlanData} variant="secondary" size="sm">
                        Retry
                      </AppButton>
                    </div>
                  ) : planData?.current.plan === 'pro' ? (
                    <>
                      <div className="profile-row">
                        <span className="profile-label">Plan</span>
                        <span className="profile-value">PRO ✓</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Replies</span>
                        <span className="profile-value">Unlimited</span>
                      </div>
                      <div className="profile-row profile-row-gap">
                        <span className="profile-label">Expires</span>
                        <span className="profile-value">{proExpiryLabel}</span>
                      </div>
                      <AppButton
                        onClick={() => navigate('/upgrade')}
                        variant="secondary"
                        size="sm"
                      >
                        Manage subscription
                      </AppButton>
                    </>
                  ) : (
                    <>
                      <div className="profile-row">
                        <span className="profile-label">Plan</span>
                        <span className="profile-value">FREE</span>
                      </div>
                      <div className="profile-row profile-row-tight">
                        <span className="profile-label">Replies today</span>
                        <span className="profile-value">
                          {repliesToday} / {repliesLimit ?? '∞'}
                        </span>
                      </div>

                      <div className="profile-progress-track" aria-label="Replies usage progress">
                        <div
                          className="profile-progress-fill"
                          style={{
                            width: `${repliesProgressPercent}%`,
                            background: repliesProgressColor,
                          }}
                        />
                      </div>

                      <div className="profile-progress-meta">
                        {repliesProgressPercent}% used
                      </div>

                      <AppButton
                        onClick={() => setActiveTab('payment')}
                        size="sm"
                        leftIcon={<Zap className="app-icon-sm" />}
                      >
                        Upgrade to Pro
                      </AppButton>
                    </>
                  )}
                  </section>

                  <section className="profile-card">
                    <p className="profile-card-title">Account Actions</p>
                    <AppButton
                      onClick={logout}
                      variant="danger"
                      size="sm"
                      leftIcon={<LogOut01 className="app-icon-sm" />}
                    >
                      → Logout
                    </AppButton>
                  </section>
                </div>
              </section>
            )}
          </main>
        </section>
      </div>

      <nav
        className="dashboard-mobile-nav"
        aria-label="Mobile dashboard navigation"
        style={{ gridTemplateColumns: `repeat(${dashboardNavItems.length}, minmax(0, 1fr))` }}
      >
        {dashboardNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.key

          return (
            <button
              key={item.key}
              className={`dashboard-mobile-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <Icon className="dashboard-mobile-tab-icon" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}