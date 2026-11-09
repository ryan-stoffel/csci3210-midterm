/* oxlint-disable react/only-export-components -- provider and its hook live together */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
type Notify = (kind: ToastKind, message: string) => void

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<Notify | null>(null)
const TOAST_MS = 4500
let nextId = 1

/** Provides a stable `notify` function. The toast list lives here, so showing a toast re-renders only this provider. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const notify = useCallback<Notify>((kind, message) => {
    const id = nextId++
    setToasts((list) => [...list.slice(-3), { id, kind, message }])
    window.setTimeout(() => dismiss(id), TOAST_MS)
  }, [dismiss])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            <button type="button" className="link" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast must be used inside ToastProvider')
  return notify
}
