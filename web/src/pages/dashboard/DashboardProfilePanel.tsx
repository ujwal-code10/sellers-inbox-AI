import { Edit03, LogOut01, Zap } from '@untitledui/icons'
import AppButton from '../../components/ui/AppButton'
import type { PlanResponse } from '../../services/api/types'

interface DashboardProfilePanelProps {
  profileName: string
  userEmail?: string
  editingName: boolean
  nameDraft: string
  savingName: boolean
  planLoading: boolean
  effectivePlanData: PlanResponse | null
  proExpiryLabel: string
  repliesToday: number
  repliesLimit: number | null
  repliesProgressPercent: number
  repliesProgressColor: string
  onNameDraftChange: (value: string) => void
  onStartEditingName: () => void
  onCancelEditingName: () => void
  onSaveName: () => void
  onRetryPlanLoad: () => void
  onManageSubscription: () => void
  onOpenPaymentTab: () => void
  onLogout: () => void
}

export default function DashboardProfilePanel({
  profileName,
  userEmail,
  editingName,
  nameDraft,
  savingName,
  planLoading,
  effectivePlanData,
  proExpiryLabel,
  repliesToday,
  repliesLimit,
  repliesProgressPercent,
  repliesProgressColor,
  onNameDraftChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveName,
  onRetryPlanLoad,
  onManageSubscription,
  onOpenPaymentTab,
  onLogout,
}: DashboardProfilePanelProps) {
  return (
    <section className="dashboard-tab-wrap">
      <div className="profile-layout">
        <section className="profile-card">
          <p className="profile-card-title">👤 Account</p>

          <div className="profile-row">
            <span className="profile-label">Name</span>

            {editingName ? (
              <div className="profile-name-editor">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => onNameDraftChange(event.target.value)}
                  className="profile-name-input"
                  aria-label="Edit account name"
                />
                <AppButton
                  onClick={onSaveName}
                  size="sm"
                  loading={savingName}
                  loadingText="Saving..."
                >
                  Save
                </AppButton>
                <AppButton
                  onClick={onCancelEditingName}
                  size="sm"
                  variant="secondary"
                >
                  Cancel
                </AppButton>
              </div>
            ) : (
              <div className="profile-name-view">
                <span className="profile-value">{profileName || 'Seller'}</span>
                <button
                  type="button"
                  onClick={onStartEditingName}
                  className="profile-edit-btn"
                  aria-label="Edit name"
                >
                  <Edit03 className="app-icon-sm" />
                </button>
              </div>
            )}
          </div>

          <div className="profile-row profile-row-last">
            <span className="profile-label">Email</span>
            <span className="profile-value">{userEmail ?? 'No email found'}</span>
          </div>
        </section>

        <section className="profile-card">
          <p className="profile-card-title">⚡ Your Plan</p>

          {!effectivePlanData && planLoading ? (
            <div className="profile-plan-empty">Loading plan details...</div>
          ) : !effectivePlanData ? (
            <div className="profile-plan-empty-wrap">
              <div className="profile-plan-empty">
                Plan details are unavailable right now.
              </div>
              <AppButton onClick={onRetryPlanLoad} variant="secondary" size="sm">
                Retry
              </AppButton>
            </div>
          ) : effectivePlanData.current.plan === 'pro' ? (
            <>
              <div className="profile-row">
                <span className="profile-label">Plan</span>
                <span className="profile-value">PRO ✓</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Replies</span>
                <span className="profile-value">Unlimited</span>
              </div>
              <div className="profile-row profile-row-gap">
                <span className="profile-label">Expires</span>
                <span className="profile-value">{proExpiryLabel}</span>
              </div>
              <AppButton
                onClick={onManageSubscription}
                variant="secondary"
                size="sm"
              >
                Manage subscription
              </AppButton>
            </>
          ) : (
            <>
              <div className="profile-row">
                <span className="profile-label">Plan</span>
                <span className="profile-value">FREE</span>
              </div>
              <div className="profile-row profile-row-tight">
                <span className="profile-label">Replies today</span>
                <span className="profile-value">
                  {repliesToday} / {repliesLimit ?? '∞'}
                </span>
              </div>

              <div className="profile-progress-track" aria-label="Replies usage progress">
                <div
                  className="profile-progress-fill"
                  style={{
                    width: `${repliesProgressPercent}%`,
                    background: repliesProgressColor,
                  }}
                />
              </div>

              <div className="profile-progress-meta">
                {repliesProgressPercent}% used
              </div>

              <AppButton
                onClick={onOpenPaymentTab}
                size="sm"
                leftIcon={<Zap className="app-icon-sm" />}
              >
                Upgrade to Pro
              </AppButton>
            </>
          )}
        </section>

        <section className="profile-card">
          <p className="profile-card-title">Account Actions</p>
          <AppButton
            onClick={onLogout}
            variant="danger"
            size="sm"
            leftIcon={<LogOut01 className="app-icon-sm" />}
          >
            → Logout
          </AppButton>
        </section>
      </div>
    </section>
  )
}
