/* oxlint-disable react-hooks/exhaustive-deps, react/set-state-in-effect -- deps are supplied by the caller, and the loading flag must flip when they change */
import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { asApiError, type ApiError } from '../api/client'

interface AsyncState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

/** Runs `load` whenever `deps` change. Keeps the previous data while reloading so tables do not flash empty. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    setState((s) => ({ ...s, loading: true }))
    load().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (err: unknown) => current && setState((s) => ({ data: s.data, error: asApiError(err), loading: false })),
    )
    return () => {
      current = false
    }
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, setData: (data: T) => setState({ data, error: null, loading: false }), reload }
}
