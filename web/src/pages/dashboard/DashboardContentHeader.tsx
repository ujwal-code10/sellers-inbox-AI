import { LogOut01, Zap } from '@untitledui/icons'
import AppButton from '../../components/ui/AppButton'
import { tabHeadings, type Tab } from './dashboardConfig'

interface DashboardContentHeaderProps {
  activeTab: Tab
  onUpgrade: () => void
  onLogout: () => void
}

export default function DashboardContentHeader({
  activeTab,
  onUpgrade,
  onLogout,
}: DashboardContentHeaderProps) {
  return (
    <div className="dashboard-content-head">
      <div>
        <p className="dashboard-content-kicker">Seller Inbox AI</p>
        <h2>{tabHeadings[activeTab].title}</h2>
        <p>{tabHeadings[activeTab].description}</p>
      </div>
      <div className="dashboard-content-actions">
        <AppButton
          onClick={onUpgrade}
          variant="pill"
          size="sm"
          leftIcon={<Zap className="app-icon-sm" />}
        >
          Upgrade
        </AppButton>
        <AppButton
          onClick={onLogout}
          className="dashboard-mobile-logout"
          variant="danger"
          size="sm"
          leftIcon={<LogOut01 className="app-icon-sm" />}
        >
          Logout
        </AppButton>
      </div>
    </div>
  )
}
