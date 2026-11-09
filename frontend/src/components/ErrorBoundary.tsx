import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches render crashes so one broken page does not blank the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card error-box" role="alert">
        <h2>Something broke on this page.</h2>
        <p className="muted">{this.state.error.message}</p>
        <button type="button" onClick={() => window.location.assign('/')}>Back to the market</button>
      </div>
    )
  }
}
