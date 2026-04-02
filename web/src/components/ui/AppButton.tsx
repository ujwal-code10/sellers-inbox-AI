import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'pill'
type ButtonSize = 'sm' | 'md' | 'lg'

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
}

export default function AppButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingText = 'Please wait...',
  leftIcon,
  disabled,
  ...props
}: AppButtonProps) {
  const composedClassName = [
    'app-btn',
    `app-btn-${variant}`,
    `app-btn-${size}`,
    fullWidth ? 'app-btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...props}
      className={composedClassName}
      disabled={disabled || loading}
    >
      {leftIcon ? <span className="app-btn-icon">{leftIcon}</span> : null}
      {loading ? loadingText : children}
    </button>
  )
}
