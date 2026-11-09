import type { ReactNode } from 'react'

/** Label + control + inline 400 error from the API. */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className={error ? 'invalid' : undefined}>
      {label}
      {children}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  )
}
