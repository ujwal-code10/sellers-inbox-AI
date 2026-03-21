import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Upgrade from './pages/Upgrade'
import PaymentSuccess from './pages/PaymentSuccess'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PaymentFailure() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', padding: '2rem'
    }}>
      <div style={{ fontSize: 48 }}>❌</div>
      <h2 style={{ marginTop: 16 }}>Payment Failed</h2>
      <p style={{ color: '#666' }}>Something went wrong. Please try again.</p>
      <button
        onClick={() => window.location.href = '/upgrade'}
        style={{
          marginTop: 16, padding: '10px 24px',
          borderRadius: 8, background: '#1D9E75',
          color: '#fff', fontWeight: 600,
          border: 'none', cursor: 'pointer', fontSize: 14
        }}
      >
        Try Again
      </button>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <Upgrade />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment/success"
        element={
          <ProtectedRoute>
            <PaymentSuccess />
          </ProtectedRoute>
        }
      />

      <Route path="/payment/failure" element={<PaymentFailure />} />
    </Routes>
  )
}

export default App