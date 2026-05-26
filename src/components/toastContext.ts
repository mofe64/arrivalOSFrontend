import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type Toast = {
  id: string
  kind: ToastKind
  title: string
  body?: string
  fieldErrors?: { field: string; message: string }[]
  requestId?: string
}

export type ToastContextValue = {
  push: (toast: Omit<Toast, 'id'>) => void
  pushError: (title: string, error: unknown) => void
  pushSuccess: (title: string, body?: string) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
