import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paymentApi } from '../services/api/paymentApi'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')

  useEffect(() => {
    const encodedData = searchParams.get('data')
    let redirectTimer: ReturnType<typeof setTimeout> | null = null

    if (!encodedData) {
      setStatus('failed')
      return
    }

    paymentApi.verifyEsewa(encodedData).then(() => {
      setStatus('success')
      redirectTimer = setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 3000)
    }).catch(() => {
      setStatus('failed')
    })

    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer)
      }
    }
  }, [navigate, searchParams])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', padding: '2rem'
    }}>
      {status === 'verifying' && (
        <>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: '#666' }}>
            Verifying your payment...
          </p>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h2 style={{ marginTop: 16 }}>Payment Successful!</h2>
          <p style={{ color: '#666' }}>
            You are now on Pro plan. Redirecting...
          </p>
        </>
      )}
      {status === 'failed' && (
        <>
          <div style={{ fontSize: 48 }}>❌</div>
          <h2 style={{ marginTop: 16 }}>Payment Failed</h2>
          <p style={{ color: '#666' }}>
            Something went wrong. Please try again.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            style={{
              marginTop: 16, padding: '10px 24px',
              borderRadius: 8, border: 'none',
              background: '#1D9E75', color: '#fff',
              cursor: 'pointer', fontWeight: 600
            }}
          >
            Try Again
          </button>
        </>
      )}
    </div>
  )
}