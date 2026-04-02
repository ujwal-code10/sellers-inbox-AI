import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

export type FeedbackType = 'success' | 'error' | 'info' | 'warning'

interface FeedbackItem {
  id: string
  type: FeedbackType
  title: string
  message?: string
}

interface UIFeedbackContextValue {
  notify: (feedback: Omit<FeedbackItem, 'id'>) => void
}

const UIFeedbackContext = createContext<UIFeedbackContextValue | null>(null)

const AUTO_DISMISS_MS = 4200

export function UIFeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((feedback: Omit<FeedbackItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    setItems((prev) => [...prev, { ...feedback, id }])

    setTimeout(() => {
      remove(id)
    }, AUTO_DISMISS_MS)
  }, [remove])

  const value = useMemo<UIFeedbackContextValue>(() => ({ notify }), [notify])

  return (
    <UIFeedbackContext.Provider value={value}>
      {children}
      <div className="app-toast-container" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`app-toast app-toast-${item.type}`} role="status">
            <div className="app-toast-content">
              <p className="app-toast-title">{item.title}</p>
              {item.message ? <p className="app-toast-message">{item.message}</p> : null}
            </div>
            <button
              type="button"
              className="app-toast-close"
              onClick={() => remove(item.id)}
              aria-label="Dismiss notification"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </UIFeedbackContext.Provider>
  )
}

export function useUIFeedback() {
  const context = useContext(UIFeedbackContext)
  if (!context) {
    throw new Error('useUIFeedback must be used within UIFeedbackProvider')
  }
  return context
}
