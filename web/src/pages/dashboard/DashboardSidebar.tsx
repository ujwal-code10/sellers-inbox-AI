import { LogOut01, User01, Zap } from '@untitledui/icons'
import AppButton from '../../components/ui/AppButton'
import { dashboardNavItems, type Tab } from './dashboardConfig'

interface DashboardSidebarProps {
  activeTab: Tab
  profileName: string
  userEmail?: string
  onSelectTab: (tab: Tab) => void
  onLogout: () => void
}

export default function DashboardSidebar({
  activeTab,
  profileName,
  userEmail,
  onSelectTab,
  onLogout,
}: DashboardSidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <Zap className="sidebar-brand-icon" />
        </div>
        <div>
          <p className="sidebar-brand-kicker">Seller Workspace</p>
          <h1>Inbox AI</h1>
        </div>
      </div>

      <p className="sidebar-section-label">Main</p>
      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        {dashboardNavItems.map((item, index) => {
          const Icon = item.icon
          const isActive = activeTab === item.key

          return (
            <button
              key={item.key}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.key)}
              style={{ animationDelay: `${0.06 * index}s` }}
            >
              <Icon className="sidebar-nav-icon" />
              <span className="sidebar-nav-copy">
                <span className="sidebar-nav-label">{item.label}</span>
                <span className="sidebar-nav-note">{item.note}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <p className="sidebar-section-label">Account</p>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-upgrade"
          onClick={() => onSelectTab('payment')}
        >
          <Zap className="sidebar-upgrade-icon" />
          <span>
            <strong>Upgrade to Pro</strong>
            <small>Unlimited replies and products</small>
          </span>
        </button>

        <div className="sidebar-profile">
          <div className="sidebar-profile-avatar">
            <User01 className="sidebar-profile-icon" />
          </div>
          <div className="sidebar-profile-copy">
            <span className="sidebar-profile-name">{profileName || 'Seller'}</span>
            <span className="sidebar-profile-email">{userEmail ?? 'seller@inbox-ai.app'}</span>
          </div>
        </div>

        <AppButton
          onClick={onLogout}
          className="sidebar-logout-btn"
          variant="secondary"
          size="sm"
          fullWidth
          leftIcon={<LogOut01 className="app-icon-sm" />}
        >
          Logout
        </AppButton>
      </div>
    </aside>
  )
}
