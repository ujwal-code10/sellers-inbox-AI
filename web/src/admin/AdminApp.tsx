import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { ToastProvider } from './context/ToastContext';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetails from './pages/UserDetails';
import Transactions from './pages/Transactions';
import Subscriptions from './pages/Subscriptions';
import AIUsage from './pages/AIUsage';
import Settings from './pages/Settings';
import './styles/admin.css';

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="admin-root admin-route-loading">
        <div className="admin-skeleton admin-route-loading-indicator" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="admin-root admin-route-loading">
        <div className="admin-skeleton admin-route-loading-indicator" />
      </div>
    );
  }

  if (admin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AdminPublicRoute>
            <AdminLogin />
          </AdminPublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AdminProtectedRoute>
            <Dashboard />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <AdminProtectedRoute>
            <Users />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <AdminProtectedRoute>
            <UserDetails />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <AdminProtectedRoute>
            <Transactions />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/subscriptions"
        element={
          <AdminProtectedRoute>
            <Subscriptions />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/ai-usage"
        element={
          <AdminProtectedRoute>
            <AIUsage />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <AdminProtectedRoute>
            <Settings />
          </AdminProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <AdminRoutes />
      </ToastProvider>
    </AdminAuthProvider>
  );
}

export default AdminApp;
