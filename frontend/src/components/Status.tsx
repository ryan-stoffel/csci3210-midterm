import type { ApiError } from '../api/client'

/** Loading / error placeholder for container pages. Renders nothing once data is ready. */
export function Status({ loading, error, onRetry }: { loading: boolean; error: ApiError | null; onRetry?: () => void }) {
  if (error) {
    return (
      <div className="card error-box" role="alert">
        <p><strong>{error.status === 404 ? 'Not found.' : 'Could not load this page.'}</strong> {error.message}</p>
        {onRetry && error.status !== 404 && <button type="button" onClick={onRetry}>Try again</button>}
      </div>
    )
  }
  return loading ? <p className="muted" aria-busy="true">Loading…</p> : null
}
