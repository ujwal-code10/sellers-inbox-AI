import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail01 } from '@untitledui/icons'
import { authApi } from '../services/api/authApi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      const response = await authApi.requestPasswordReset(email)
      setSuccessMessage(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-forgot">
        <div className="auth-header">
          <div className="auth-logo-badge">SIA</div>
          <h1>Forgot password?</h1>
          <p>No worries, enter your email and we will send reset instructions.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error ? <div className="error-message">{error}</div> : null}
          {successMessage ? <div className="auth-success-message">{successMessage}</div> : null}

          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <div className="auth-input-wrap">
              <Mail01 className="auth-input-icon" />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset instructions'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Remember your password? <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
