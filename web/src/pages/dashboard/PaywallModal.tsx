import { Zap } from '@untitledui/icons'
import AppButton from '../../components/ui/AppButton'

interface PaywallModalProps {
  isOpen: boolean
  reason: 'replies' | 'products'
  onClose: () => void
  onUpgrade: () => void
}

export default function PaywallModal({
  isOpen,
  reason,
  onClose,
  onUpgrade,
}: PaywallModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal paywall-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="paywall-icon"><Zap className="paywall-icon-svg" /></div>
        <h3 className="paywall-title">
          {reason === 'replies'
            ? "You've used all 20 free replies today"
            : "You've reached the 5 product limit"
          }
        </h3>
        <p className="paywall-message">
          {reason === 'replies'
            ? 'Upgrade to Pro for unlimited replies every day'
            : 'Upgrade to Pro for unlimited products'
          }
        </p>
        <AppButton
          onClick={onUpgrade}
          variant="primary"
          size="lg"
          fullWidth
          className="paywall-upgrade-btn"
        >
          Upgrade to Pro - Rs. 299/month
        </AppButton>
        <AppButton
          onClick={onClose}
          variant="secondary"
          fullWidth
        >
          Maybe later
        </AppButton>
      </div>
    </div>
  )
}
