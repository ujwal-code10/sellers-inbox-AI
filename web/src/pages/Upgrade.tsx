import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface PlanData {
  current: {
    plan: string
    billing: string | null
    status: string
    expires_at: string | null
  }
  usage: {
    replies_today: number
    replies_limit: number | null
    products: number
    products_limit: number | null
  }
  plans: {
    free: { price: number; replies_per_day: number; products: number }
    pro_monthly: { price: number; replies_per_day: null; products: null }
    pro_yearly: { price: number; replies_per_day: null; products: null }
  }
}

export default function Upgrade() {
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [initiating, setInitiating] = useState(false)
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => { loadPlans() }, [])

  const loadPlans = async () => {
    try {
      const data = await api.getPlans()
      setPlanData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setInitiating(true)
    try {
      const data = await api.initiateEsewa(selectedBilling)

      // Build and submit eSewa form
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.esewaUrl

      const fields = {
        amount: data.amount,
        tax_amount: 0,
        total_amount: data.amount,
        transaction_uuid: data.transactionUuid,
        product_code: data.productCode,
        product_service_charge: 0,
        product_delivery_charge: 0,
        success_url: data.successUrl,
        failure_url: data.failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: data.signature,
      }

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      console.error(err)
      setInitiating(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <div className="spinner" />
    </div>
  )

  const isPro = planData?.current.plan === 'pro'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: 4 }}>Upgrade to Pro</h2>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>
        Remove limits and reply to unlimited customers
      </p>

      {/* Current Usage */}
      {planData && (
        <div style={{
          background: '#f9f9f9', borderRadius: 12,
          padding: 16, marginBottom: 24,
          border: '0.5px solid #e5e5e5'
        }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            Your usage today
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>
                {planData.usage.replies_today}
              </span>
              <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
                / {planData.usage.replies_limit ?? '∞'} replies
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>
                {planData.usage.products}
              </span>
              <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
                / {planData.usage.products_limit ?? '∞'} products
              </span>
            </div>
          </div>
        </div>
      )}

      {isPro ? (
        <div style={{
          background: '#E1F5EE', borderRadius: 12,
          padding: 20, textAlign: 'center',
          border: '0.5px solid #1D9E75'
        }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div style={{ fontWeight: 600, marginTop: 8 }}>
            You are on Pro plan
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            {planData?.current.expires_at
              ? `Renews ${new Date(planData.current.expires_at).toLocaleDateString()}`
              : 'Active'
            }
          </div>
        </div>
      ) : (
        <>
          {/* Billing Toggle */}
          <div style={{
            display: 'flex', gap: 8,
            marginBottom: 24, background: '#f5f5f5',
            borderRadius: 10, padding: 4
          }}>
            {(['monthly', 'yearly'] as const).map(b => (
              <button
                key={b}
                onClick={() => setSelectedBilling(b)}
                style={{
                  flex: 1, padding: '8px 0',
                  borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontSize: 13,
                  fontWeight: selectedBilling === b ? 600 : 400,
                  background: selectedBilling === b ? '#fff' : 'transparent',
                  color: selectedBilling === b ? '#1a1a1a' : '#888',
                  boxShadow: selectedBilling === b
                    ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {b === 'monthly' ? 'Monthly' : 'Yearly (save 30%)'}
              </button>
            ))}
          </div>

          {/* Plan Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {/* Free */}
            <div style={{
              flex: 1, borderRadius: 12, padding: 16,
              border: '0.5px solid #e5e5e5', background: '#fff'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Free</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Rs. 0</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
                forever
              </div>
              {[
                '20 replies per day',
                '5 products',
                'All features included',
              ].map(f => (
                <div key={f} style={{
                  fontSize: 12, color: '#555',
                  marginBottom: 4
                }}>
                  ✓ {f}
                </div>
              ))}
            </div>

            {/* Pro */}
            <div style={{
              flex: 1, borderRadius: 12, padding: 16,
              border: '2px solid #1D9E75',
              background: '#f0fdf8', position: 'relative'
            }}>
              <div style={{
                position: 'absolute', top: -10, right: 12,
                background: '#1D9E75', color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20
              }}>
                POPULAR
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Pro</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                Rs. {selectedBilling === 'yearly' ? '2,499' : '299'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
                per {selectedBilling === 'yearly' ? 'year' : 'month'}
              </div>
              {[
                'Unlimited replies',
                'Unlimited products',
                'All features included',
                selectedBilling === 'yearly' ? '2 months free' : '',
              ].filter(Boolean).map(f => (
                <div key={f} style={{
                  fontSize: 12, color: '#085041',
                  marginBottom: 4
                }}>
                  ✓ {f}
                </div>
              ))}
            </div>
          </div>

          {/* eSewa Button */}
          <button
            onClick={handleUpgrade}
            disabled={initiating}
            style={{
              width: '100%', padding: '14px 0',
              borderRadius: 12, border: 'none',
              background: initiating ? '#ccc' : '#60BB46',
              color: '#fff', fontWeight: 700,
              fontSize: 15, cursor: initiating ? 'not-allowed' : 'pointer'
            }}
          >
            {initiating
              ? 'Redirecting to eSewa...'
              : `Pay with eSewa — Rs. ${selectedBilling === 'yearly' ? '2,499' : '299'}`
            }
          </button>

          <div style={{
            textAlign: 'center', fontSize: 11,
            color: '#888', marginTop: 10
          }}>
            Secure payment via eSewa • Cancel anytime
          </div>
        </>
      )}
    </div>
  )
}