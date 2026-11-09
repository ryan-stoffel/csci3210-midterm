import type { ReactNode } from 'react'
import { capitalize, dateTime } from '../format'
import type { InventoryItem, TradeOffer } from '../types'
import { ItemName } from './ItemName'

function ItemList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) return <p className="muted small">Nothing</p>
  return <ul className="plain">{items.map((i) => <li key={i.id}><ItemName type={i.item_type} /></li>)}</ul>
}

/** One barter offer, written from the viewer's side ("You give" / "You get"). */
export function TradeCard({ trade, viewer, actions }: { trade: TradeOffer; viewer: string; actions?: ReactNode }) {
  const outgoing = trade.sender === viewer
  return (
    <article className="card trade-card">
      <header className="row spread">
        <strong>{outgoing ? `To ${trade.recipient}` : `From ${trade.sender}`}</strong>
        <span className={`pill pill-${trade.status}`}>{capitalize(trade.status)}</span>
      </header>
      {trade.message && <p className="quote">“{trade.message}”</p>}
      <div className="trade-sides">
        <section><h3>You give</h3><ItemList items={outgoing ? trade.offered_items : trade.requested_items} /></section>
        <section><h3>You get</h3><ItemList items={outgoing ? trade.requested_items : trade.offered_items} /></section>
      </div>
      <footer className="row spread">
        <span className="muted small">{dateTime(trade.created_at)}</span>
        {actions && <div className="row">{actions}</div>}
      </footer>
    </article>
  )
}
