import { useEffect, useState } from 'react'
import { timeLeft } from '../format'

/** Self-updating countdown. Ticks in isolation so the parent table or page does not re-render every second. */
export function TimeLeft({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <time dateTime={endsAt}>{timeLeft(endsAt, now)}</time>
}
