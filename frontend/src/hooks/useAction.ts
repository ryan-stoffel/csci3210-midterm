import { useCallback, useState } from 'react'
import { asApiError } from '../api/client'
import { useToast } from '../context/ToastContext'

/**
 * Wraps a mutation. 400 field errors go to `fieldErrors` for inline display, every other failure becomes
 * an error toast. `run` resolves to the result, or undefined if the call failed.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const notify = useToast()
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true)
    setFieldErrors({})
    try {
      return await fn(...args)
    } catch (err) {
      const apiErr = asApiError(err)
      setFieldErrors(apiErr.fieldErrors)
      notify('error', apiErr.message)
      return undefined
    } finally {
      setPending(false)
    }
  }, [fn, notify])

  return { run, pending, fieldErrors }
}
