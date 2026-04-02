import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/admin.css';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="admin-root">
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <h1 className="admin-login-title">Admin Login</h1>
            <p className="admin-login-subtitle">
              Sign in to access the admin panel
            </p>
          </div>

          {error && <div className="admin-login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="admin-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="admin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
