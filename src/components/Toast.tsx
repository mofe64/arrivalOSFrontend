import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api/types'
import { ToastContext, type Toast, type ToastContextValue } from './toastContext'

const AUTO_DISMISS_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { ...toast, id }])
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      pushSuccess: (title, body) => push({ kind: 'success', title, body }),
      pushError: (title, error) => {
        if (error instanceof ApiError) {
          push({
            kind: 'error',
            title,
            body: error.message,
            fieldErrors: error.fieldErrors,
            requestId: error.requestId,
          })
        } else if (error instanceof Error) {
          push({ kind: 'error', title, body: error.message })
        } else {
          push({ kind: 'error', title })
        }
      },
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} onDismiss={() => onDismiss(toast.id)} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <article className="toast" data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <header>
        <strong>{toast.title}</strong>
        <button aria-label="Dismiss" onClick={onDismiss} type="button">×</button>
      </header>
      {toast.body && <p>{toast.body}</p>}
      {toast.fieldErrors && toast.fieldErrors.length > 0 && (
        <ul>
          {toast.fieldErrors.map((fieldError) => (
            <li key={`${fieldError.field}-${fieldError.message}`}>
              <strong>{fieldError.field}</strong>: {fieldError.message}
            </li>
          ))}
        </ul>
      )}
      {toast.requestId && <small>Request {toast.requestId}</small>}
    </article>
  )
}
