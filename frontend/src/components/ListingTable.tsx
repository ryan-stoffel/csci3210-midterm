import { Link } from 'react-router-dom'
import { capitalize, gold } from '../format'
import type { Listing } from '../types'
import { ItemName } from './ItemName'
import { TimeLeft } from './TimeLeft'

export function ListingTable({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) return <p className="empty">No listings match these filters.</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Category</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">Price</th>
            <th scope="col" className="num">Bids</th>
            <th scope="col">Seller</th>
            <th scope="col">Ends</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td><Link to={`/listings/${l.id}`}><ItemName type={l.item.item_type} /></Link></td>
              <td>{capitalize(l.item.item_type.category)}</td>
              <td><span className={`pill pill-${l.kind}`}>{l.kind === 'fixed' ? 'Buy now' : 'Auction'}</span></td>
              <td className="num">{gold(l.current_price)}</td>
              <td className="num">{l.kind === 'auction' ? l.bid_count : '—'}</td>
              <td>{l.seller}</td>
              <td>{l.status !== 'active' ? capitalize(l.status) : l.ends_at ? <TimeLeft endsAt={l.ends_at} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
