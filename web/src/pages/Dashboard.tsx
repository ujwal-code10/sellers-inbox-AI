import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUIFeedback } from '../context/UIFeedbackContext'
import {
  type DeliveryZone,
  type Product,
  type PlanResponse,
  type ManualQrConfigResponse,
  type SuggestReplyResponse,
} from '../services/api/types'
import { aiApi } from '../services/api/aiApi'
import { authApi } from '../services/api/authApi'
import { deliveryApi } from '../services/api/deliveryApi'
import { paymentApi } from '../services/api/paymentApi'
import { productApi } from '../services/api/productApi'
import Products from './Products'
import DeliveryZones from './DeliveryZones'
import Upgrade from './Upgrade'
import { copyToClipboard } from './dashboard/clipboard'
import { dashboardNavItems, type Tab } from './dashboard/dashboardConfig'
import PaywallModal from './dashboard/PaywallModal'
import DashboardSidebar from './dashboard/DashboardSidebar'
import DashboardContentHeader from './dashboard/DashboardContentHeader'
import DashboardProfilePanel from './dashboard/DashboardProfilePanel'
import DashboardReplyTab from './dashboard/DashboardReplyTab'
import { captureClientError } from '../services/monitoring'

type ReplyResult = SuggestReplyResponse

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
  const [cachedProducts, setCachedProducts] = useState<Product[] | null>(null)
  const [cachedZones, setCachedZones] = useState<DeliveryZone[] | null>(null)
  const [cachedPlan, setCachedPlan] = useState<PlanResponse | null>(null)
  const [cachedQrConfig, setCachedQrConfig] = useState<ManualQrConfigResponse | null>(null)
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
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [recentProductNames, setRecentProductNames] = useState<string[]>([])

  useEffect(() => {
    let active = true

    Promise.all([
      productApi.getProducts(),
      deliveryApi.getDeliveryZones(),
      paymentApi.getPlans(),
      paymentApi.getManualQrConfig(),
    ])
      .then(([productsData, zonesData, plan, qrConfig]) => {
        if (!active) return
        setCachedProducts(productsData)
        setProducts(productsData)
        setCachedZones(zonesData)
        setCachedPlan(plan)
        setPlanData(plan)
        setCachedQrConfig(qrConfig)
      })
      .catch((err) => {
        captureClientError('Dashboard prefetch failed', err, {
          scope: 'DashboardPrefetch',
        })
      })

    return () => {
      active = false
    }
  }, [])

  // Load products when reply tab is active
  useEffect(() => {
    if (activeTab === 'reply' && products.length === 0 && !productsLoading) {
      loadProducts()
    }
  }, [activeTab, products.length, productsLoading])

  useEffect(() => {
    const nextName = user?.name ?? ''
    setProfileName(nextName)
    if (!editingName) {
      setNameDraft(nextName)
    }
  }, [user?.name, editingName])

  useEffect(() => {
    if (activeTab === 'profile') {
      if (!planData && !planLoading) {
        loadPlanData()
      }
    }
  }, [activeTab, planData, planLoading])

  useEffect(() => {
    if (cachedProducts !== null) {
      setProducts(cachedProducts)
    }
  }, [cachedProducts])

  useEffect(() => {
    if (cachedPlan) {
      setPlanData(cachedPlan)
    }
  }, [cachedPlan])

  const loadProducts = async () => {
    if (cachedProducts !== null) {
      setProducts(cachedProducts)
      return
    }

    setProductsLoading(true)
    try {
      const productsData = await productApi.getProducts()
      setProducts(productsData)
      setCachedProducts(productsData)
    } catch (err) {
      captureClientError('Failed to load products', err, {
        scope: 'DashboardLoadProducts',
      })
    } finally {
      setProductsLoading(false)
    }
  }

  const loadPlanData = async () => {
    if (cachedPlan) {
      setPlanData(cachedPlan)
      return
    }

    setPlanLoading(true)
    try {
      const data = await paymentApi.getPlans()
      setPlanData(data)
      setCachedPlan(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plan details'
      notify({ type: 'error', title: 'Could not load plan details', message })
    } finally {
      setPlanLoading(false)
    }
  }

  // Filter products based on search and sort alphabetically.
  const searchFilteredProducts = products
    .filter(product =>
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.keywords && product.keywords.toLowerCase().includes(productSearch.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const productByName = new Map(products.map((product) => [product.name.toLowerCase(), product]))

  const quickPickProducts = (result?.decision.productCandidates || [])
    .map((name) => productByName.get(name.toLowerCase()))
    .filter((product): product is Product => Boolean(product))

  const quickPickNameSet = new Set(quickPickProducts.map((product) => product.name.toLowerCase()))

  const browseProducts = searchFilteredProducts
    .filter((product) => !quickPickNameSet.has(product.name.toLowerCase()))
    .slice(0, 8)

  const addRecentProduct = (productName: string) => {
    setRecentProductNames((previous) => {
      const deduped = previous.filter((name) => name.toLowerCase() !== productName.toLowerCase())
      return [productName, ...deduped].slice(0, 5)
    })
  }

  const handleProductSelect = async (productName: string) => {
    if (!customerMessage.trim()) return

    setError('')
    setLoading(true)
    setShowProductPicker(false)
    setShowProductSearch(false)
    setProductSearch('')

    try {
      const response = await aiApi.suggestReply(customerMessage.trim(), undefined, productName)
      setResult(response)
      addRecentProduct(productName)
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
    setShowProductSearch(false)

    try {
      const response = await aiApi.suggestReply(
        customerMessage.trim(),
        undefined,
        undefined,
        {
          source: 'DM',
          recentProducts: recentProductNames,
        }
      )
      setResult(response)
      if (response.decision.matchedProduct) {
        addRecentProduct(response.decision.matchedProduct)
      }
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
    setShowProductSearch(false)
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
      const response = await authApi.updateMeName(nextName)
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

  const effectivePlanData = cachedPlan ?? planData

  const repliesToday = effectivePlanData?.usage.replies_today ?? 0
  const repliesLimit = effectivePlanData?.usage.replies_limit
  const repliesProgressPercent = repliesLimit
    ? Math.min(100, Math.round((repliesToday / repliesLimit) * 100))
    : 100

  const repliesProgressColor = repliesProgressPercent > 95
    ? '#dc2626'
    : repliesProgressPercent >= 80
      ? '#d97706'
      : '#1d9e75'

  const proExpiryLabel = effectivePlanData?.current.expires_at
    ? new Date(effectivePlanData.current.expires_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    : 'Active'

  return (
    <div className="dashboard">
      <PaywallModal
        isOpen={showPaywall}
        reason={paywallReason}
        onClose={() => setShowPaywall(false)}
        onUpgrade={() => navigate('/upgrade')}
      />

      <div className="dashboard-shell">
        <DashboardSidebar
          activeTab={activeTab}
          profileName={profileName}
          userEmail={user?.email}
          onSelectTab={setActiveTab}
          onLogout={logout}
        />

        <section className="dashboard-content">
          <DashboardContentHeader
            activeTab={activeTab}
            onUpgrade={() => setActiveTab('payment')}
            onLogout={logout}
          />

          <main className="dashboard-main">
            {activeTab === 'reply' && (
              <DashboardReplyTab
                customerMessage={customerMessage}
                onCustomerMessageChange={(value) => {
                  setCustomerMessage(value)
                  setShowProductPicker(false)
                }}
                loading={loading}
                onGenerate={handleGenerate}
                onClear={handleClear}
                showClearButton={Boolean(customerMessage || result)}
                onCopyOrderForm={handleCopyOrderForm}
                orderFormCopied={orderFormCopied}
                error={error}
                result={result}
                copiedIndex={copiedIndex}
                onCopySuggestion={handleCopy}
                showProductPicker={showProductPicker}
                quickPickProducts={quickPickProducts}
                recentProductNames={recentProductNames}
                showProductSearch={showProductSearch}
                onEnableProductSearch={() => setShowProductSearch(true)}
                productSearch={productSearch}
                onProductSearchChange={setProductSearch}
                browseProducts={browseProducts}
                productsCount={products.length}
                onProductSelect={handleProductSelect}
                onCancelPicker={() => {
                  setShowProductPicker(false)
                  setShowProductSearch(false)
                  setProductSearch('')
                }}
              />
            )}

            {activeTab === 'products' && (
              <section className="dashboard-tab-wrap">
                <div className="dashboard-tab-surface">
                  <Products initialData={cachedProducts} onDataChange={setCachedProducts} />
                </div>
              </section>
            )}
            {activeTab === 'delivery' && (
              <section className="dashboard-tab-wrap">
                <div className="dashboard-tab-surface">
                  <DeliveryZones initialData={cachedZones} onDataChange={setCachedZones} />
                </div>
              </section>
            )}
            {activeTab === 'payment' && (
              <section className="dashboard-tab-wrap">
                <div className="payment-tab-wrap">
                  <Upgrade
                    initialPlanData={cachedPlan}
                    initialQrConfig={cachedQrConfig}
                    onPaymentDataLoaded={({ plan, qrConfig }) => {
                      setCachedPlan(plan)
                      setPlanData(plan)
                      setCachedQrConfig(qrConfig)
                    }}
                  />
                </div>
              </section>
            )}
            {activeTab === 'profile' && (
              <DashboardProfilePanel
                profileName={profileName}
                userEmail={user?.email}
                editingName={editingName}
                nameDraft={nameDraft}
                savingName={savingName}
                planLoading={planLoading}
                effectivePlanData={effectivePlanData}
                proExpiryLabel={proExpiryLabel}
                repliesToday={repliesToday}
                repliesLimit={repliesLimit ?? null}
                repliesProgressPercent={repliesProgressPercent}
                repliesProgressColor={repliesProgressColor}
                onNameDraftChange={setNameDraft}
                onStartEditingName={() => {
                  setNameDraft(profileName)
                  setEditingName(true)
                }}
                onCancelEditingName={() => {
                  setNameDraft(profileName)
                  setEditingName(false)
                }}
                onSaveName={handleSaveName}
                onRetryPlanLoad={loadPlanData}
                onManageSubscription={() => navigate('/upgrade')}
                onOpenPaymentTab={() => setActiveTab('payment')}
                onLogout={logout}
              />
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