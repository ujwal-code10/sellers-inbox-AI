import { useEffect, useState } from 'react'
import { api, type PlanResponse, type ManualQrConfigResponse, type BillingCycle } from '../services/api'

function normalizeQrImageUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null

  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }

  const normalizedPath = trimmed
    .replace(/^\.\//, '')
    .replace(/^public\//i, '')
    .replace(/^\/+/, '')

  return normalizedPath ? `/${normalizedPath}` : null
}

export default function Upgrade() {
  const [planData, setPlanData] = useState<PlanResponse | null>(null)
  const [qrConfig, setQrConfig] = useState<ManualQrConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingQr, setSubmittingQr] = useState(false)
  const [selectedBilling, setSelectedBilling] = useState<BillingCycle>('monthly')
  const [paymentReference, setPaymentReference] = useState('')
  const [payerName, setPayerName] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualSuccess, setManualSuccess] = useState<{
    transactionId: number
    amount: number
    message: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => { loadPlans() }, [])

  const loadPlans = async () => {
    setErrorMessage('')
    try {
      const [data, config] = await Promise.all([
        api.getPlans(),
        api.getManualQrConfig(),
      ])

      setPlanData(data)
      setQrConfig(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load payment options'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitManualQr = async () => {
    const reference = paymentReference.trim()
    const payer = payerName.trim()

    if (!reference) {
      setErrorMessage('Please enter your payment reference ID.')
      return
    }

    if (payer.length < 2) {
      setErrorMessage('Please enter payer name used in the wallet payment.')
      return
    }

    if (reference.length < 4 || reference.length > 80) {
      setErrorMessage('Payment reference must be between 4 and 80 characters.')
      return
    }

    setSubmittingQr(true)
    setErrorMessage('')
    try {
      const result = await api.submitManualQrPayment({
        billing: selectedBilling,
        paymentReference: reference,
        payerName: payer,
        note: manualNote.trim() || undefined,
      })

      setManualSuccess({
        transactionId: result.transaction_id,
        amount: result.amount,
        message: result.message,
      })
      setPaymentReference('')
      setPayerName('')
      setManualNote('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit QR payment'
      setErrorMessage(message)
    } finally {
      setSubmittingQr(false)
    }
  }

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // no-op fallback for older browsers
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <div className="spinner" />
    </div>
  )

  const isPro = planData?.current.plan === 'pro'
  const selectedAmount = selectedBilling === 'yearly'
    ? (qrConfig?.amounts.yearly ?? planData?.plans.pro_yearly.price ?? 2499)
    : (qrConfig?.amounts.monthly ?? planData?.plans.pro_monthly.price ?? 299)
  const qrImageUrl = normalizeQrImageUrl(qrConfig?.qr_image_url)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: 4 }}>Upgrade to Pro</h2>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
        Remove limits and reply to unlimited customers
      </p>

      {errorMessage ? (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          color: '#9f1239',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {errorMessage}
        </div>
      ) : null}

      {/* Payment note */}
      <div style={{
        background: '#ecfdf3',
        border: '1px solid #b7e8cc',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 24,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#085f46', marginBottom: 4 }}>
          Manual QR payment only
        </div>
        <div style={{ fontSize: 12, color: '#347763' }}>
          Transfer via QR and submit your reference for fast verification.
        </div>
      </div>

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

          <div style={{
            border: '1px solid #dbe7e1',
            borderRadius: 14,
            padding: 16,
            background: '#fbfffd',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#153126' }}>Manual QR payment</div>
                <div style={{ fontSize: 13, color: '#4f655c', marginTop: 3 }}>
                  Transfer exactly Rs. {selectedAmount.toLocaleString()} and submit the payment reference below.
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d9e75' }}>
                Amount: Rs. {selectedAmount.toLocaleString()}
              </div>
            </div>

            {qrImageUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <img
                  src={qrImageUrl}
                  alt="Manual QR payment"
                  style={{
                    width: '100%',
                    maxWidth: 240,
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid #d5e2dc',
                    background: '#fff',
                    padding: 8,
                  }}
                />
              </div>
            ) : (
              <div style={{
                border: '1px dashed #c8d8d1',
                borderRadius: 12,
                padding: '18px 12px',
                textAlign: 'center',
                fontSize: 13,
                color: '#667a71',
                marginBottom: 14,
              }}>
                QR image not available. Set MANUAL_QR_IMAGE_URL to /qr.jpeg or a full https URL.
              </div>
            )}

            <div style={{
              border: '1px solid #deebe5',
              borderRadius: 10,
              background: '#fff',
              padding: 12,
              marginBottom: 14,
              display: 'grid',
              gap: 6,
            }}>
              <div style={{ fontSize: 13 }}><strong>Receiver:</strong> {qrConfig?.receiver_name || 'Seller Inbox AI'}</div>
              <div style={{ fontSize: 13 }}><strong>Wallet/ID:</strong> {qrConfig?.receiver_id || '-'}</div>
              <button
                type="button"
                onClick={() => handleCopy(qrConfig?.receiver_id || '')}
                style={{
                  marginTop: 2,
                  justifySelf: 'start',
                  border: '1px solid #d8e2dd',
                  background: '#f7fbf9',
                  color: '#27473b',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy receiver ID
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#5d7268', marginBottom: 8 }}>
              1. Scan QR and send payment.
            </div>
            <div style={{ fontSize: 12, color: '#5d7268', marginBottom: 8 }}>
              2. Enter payment reference from your wallet app.
            </div>
            <div style={{ fontSize: 12, color: '#5d7268', marginBottom: 14 }}>
              3. Submit and wait for verification.
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <input
                type="text"
                placeholder="Payment reference ID (required)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #d5e1dc',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <input
                type="text"
                placeholder="Payer name (required)"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #d5e1dc',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <textarea
                placeholder="Note (optional)"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  border: '1px solid #d5e1dc',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />

              <button
                type="button"
                onClick={handleSubmitManualQr}
                disabled={submittingQr}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: submittingQr ? '#c8cecb' : '#1D9E75',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: submittingQr ? 'not-allowed' : 'pointer',
                }}
              >
                {submittingQr ? 'Submitting...' : 'Submit for verification'}
              </button>
            </div>

            {manualSuccess ? (
              <div style={{
                marginTop: 14,
                borderRadius: 10,
                border: '1px solid #bce8d8',
                background: '#ecfdf5',
                padding: '10px 12px',
                color: '#0f5132',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Submitted successfully</div>
                <div>{manualSuccess.message}</div>
                <div style={{ marginTop: 5 }}>
                  Request ID: #{manualSuccess.transactionId} • Amount: Rs. {manualSuccess.amount.toLocaleString()}
                </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>
                    Your plan stays Free until admin approves this request.
                  </div>
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: '#6f8178', marginTop: 12 }}>
              {qrConfig?.support_text || 'After submitting, our team verifies your payment and activates Pro.'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}