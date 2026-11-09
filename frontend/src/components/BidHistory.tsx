import { dateTime, gold } from '../format'
import type { Bid } from '../types'

export function BidHistory({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) return <p className="empty">No bids yet.</p>
  return (
    <table>
      <thead>
        <tr><th scope="col">Bidder</th><th scope="col" className="num">Amount</th><th scope="col">Time</th></tr>
      </thead>
      <tbody>
        {bids.map((b, i) => (
          <tr key={b.id} className={i === 0 ? 'highlight' : undefined}>
            <td>{b.bidder}{i === 0 && <span className="pill pill-top">Top</span>}</td>
            <td className="num">{gold(b.amount)}</td>
            <td>{dateTime(b.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
