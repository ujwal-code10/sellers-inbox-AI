import { ReactNode } from 'react'

type AlertType = 'error' | 'success' | 'info' | 'warning'

interface AppAlertProps {
  type?: AlertType
  title?: string
  children?: ReactNode
}

export default function AppAlert({
  type = 'info',
  title,
  children,
}: AppAlertProps) {
  return (
    <div className={`app-alert app-alert-${type}`} role="alert">
      {title ? <p className="app-alert-title">{title}</p> : null}
      {children ? <p className="app-alert-message">{children}</p> : null}
    </div>
  )
}
