import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/admin/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { path: '/admin/transactions', label: 'Transactions', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { path: '/admin/subscriptions', label: 'Subscriptions', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
  { path: '/admin/ai-usage', label: 'AI Usage', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/admin/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { admin, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="admin-root">
      <div className="admin-layout">
        <button
          type="button"
          className={`admin-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-header">
            <span className="admin-sidebar-brand">
              <span className="admin-sidebar-brand-dot" />
              <span>
                <span className="admin-sidebar-logo">Seller Inbox</span>
                <span className="admin-sidebar-subtitle">Admin Panel</span>
              </span>
            </span>
          </div>

          <nav className="admin-sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${
                  location.pathname === item.path ? 'active' : ''
                }`}
              >
                <NavIcon path={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <button type="button" className="admin-nav-item" onClick={logout}>
              <NavIcon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-left">
              <button
                type="button"
                className="admin-mobile-menu-btn"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  width={18}
                  height={18}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Breadcrumb />
            </div>
            <div className="admin-topbar-right">
              {admin && (
                <div className="admin-user-pill">
                  <div className="admin-avatar">
                    {admin.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="admin-topbar-user-name">
                    {admin.name}
                  </span>
                </div>
              )}
            </div>
          </header>

          <div className="admin-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const items: { label: string; path?: string }[] = [];

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    const fullPath = '/' + pathParts.slice(0, i + 1).join('/');

    // Skip 'admin' prefix in display
    if (part === 'admin') continue;

    // Format label
    let label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');

    // Check if this is a dynamic segment (e.g., user ID)
    if (/^\d+$/.test(part)) {
      label = `#${part}`;
    }

    // Last item has no link
    if (i === pathParts.length - 1) {
      items.push({ label });
    } else {
      items.push({ label, path: fullPath });
    }
  }

  return (
    <div className="admin-breadcrumb">
      <Link to="/admin/dashboard">Home</Link>
      {items.map((item, index) => (
        <span key={index}>
          <span className="admin-breadcrumb-separator">/</span>
          {item.path ? (
            <Link to={item.path}>{item.label}</Link>
          ) : (
            <span className="admin-breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export default AdminLayout;
