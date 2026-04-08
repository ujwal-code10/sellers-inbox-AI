import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock01, Mail01, Shield03 } from '@untitledui/icons';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Frontend validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      // Map backend errors to user-friendly messages
      const message = err.message || 'Login failed';
      if (message.includes('Invalid credentials')) {
        setError('Invalid email or password');
      } else if (message.includes('disabled')) {
        setError('This account has been disabled');
      } else if (message.includes('Too many')) {
        setError('Too many login attempts. Please try again in 15 minutes');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">ADM</div>
          <h1>Admin portal login</h1>
          <p>Secure access for authorized team members only.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="auth-input-wrap">
              <Mail01 className="auth-input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrap">
              <Lock01 className="auth-input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="auth-input-with-toggle"
              />
              <button
                type="button"
                className="auth-visibility-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="auth-visibility-icon" />
                ) : (
                  <Eye className="auth-visibility-icon" />
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in to admin'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Need admin access? Contact a super admin.
          </p>
          <p>
            <Shield03 className="auth-visibility-icon" style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            <Link to="/login">Back to seller login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
