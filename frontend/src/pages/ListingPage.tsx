import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { marketApi } from '../api/market'
import { BidHistory } from '../components/BidHistory'
import { Field } from '../components/Field'
import { ItemName } from '../components/ItemName'
import { Status } from '../components/Status'
import { TimeLeft } from '../components/TimeLeft'
import { useAuth, useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { capitalize, dateTime, gold } from '../format'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'
import type { ListingDetail } from '../types'

export function ListingPage() {
  const id = Number(useParams().id)
  const user = useUser()
  const { refreshUser } = useAuth()
  const notify = useToast()
  const { data: listing, error, loading, reload, setData } = useAsync(() => marketApi.listing(id), [id])
  const [amount, setAmount] = useState('')

  // After any action: show the new listing state, refresh the wallet, and reload on failure (state may have moved).
  const act = async (call: () => Promise<ListingDetail>, success: string) => {
    const updated = await call()
    setData(updated)
    notify('success', success)
    await refreshUser()
    return true
  }
  const action = useAction(act)
  const doAction = async (call: () => Promise<ListingDetail>, success: string) => {
    if ((await action.run(call, success)) === undefined) reload()
  }

  if (!listing) return <Status loading={loading} error={error} onRetry={reload} />

  const t = listing.item.item_type
  const mine = listing.seller === user.username
  const active = listing.status === 'active'

  const bid = (e: FormEvent) => {
    e.preventDefault()
    void doAction(() => marketApi.bid(id, Number(amount)), `Bid of ${gold(Number(amount))} placed.`).then(() => setAmount(''))
  }

  return (
    <div className="detail">
      <p><Link to="/">← Back to market</Link></p>
      <article className={`card border-rarity-${t.rarity}`}>
        <div className="row spread">
          <h1><ItemName type={t} showRarity /></h1>
          <span className={`pill pill-${listing.status}`}>{capitalize(listing.status)}</span>
        </div>
        <p className="muted">{capitalize(t.category)} · base value {gold(t.base_value)}</p>
        <p>{t.description}</p>
        <dl className="facts">
          <dt>Seller</dt><dd>{listing.seller}{mine && ' (you)'}</dd>
          <dt>{listing.kind === 'fixed' ? 'Price' : !active && listing.bid_count ? 'Final price' : listing.bid_count ? 'Current bid' : 'Opening bid'}</dt>
          <dd className="gold-amount">{gold(listing.current_price)}</dd>
          {listing.ends_at && <><dt>{active ? 'Ends in' : 'Ended'}</dt><dd>{active ? <TimeLeft endsAt={listing.ends_at} /> : dateTime(listing.ends_at)}</dd></>}
          {listing.buyer && <><dt>Winner</dt><dd>{listing.buyer}</dd></>}
        </dl>

        {active && !mine && listing.kind === 'fixed' && (
          <button type="button" disabled={action.pending}
            onClick={() => window.confirm(`Buy ${t.name} for ${gold(listing.price)}?`) && void doAction(() => marketApi.buy(id), `You bought ${t.name}.`)}>
            Buy now for {gold(listing.price)}
          </button>
        )}

        {active && !mine && listing.kind === 'auction' && listing.min_next_bid !== null && (
          <form className="row bid-form" onSubmit={bid}>
            <Field label={`Your bid (min ${gold(listing.min_next_bid)})`} error={action.fieldErrors.amount}>
              <input type="number" required min={listing.min_next_bid} value={amount}
                placeholder={String(listing.min_next_bid)} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <button type="submit" disabled={action.pending}>Place bid</button>
          </form>
        )}
        {active && listing.top_bidder === user.username && <p className="note">You are the top bidder. Your gold is held until you are outbid.</p>}

        {active && mine && (
          <button type="button" className="danger" disabled={action.pending || listing.bid_count > 0}
            title={listing.bid_count > 0 ? 'Auctions with bids cannot be cancelled' : undefined}
            onClick={() => void doAction(() => marketApi.cancel(id), 'Listing cancelled. The item is back in your inventory.')}>
            Cancel listing
          </button>
        )}
      </article>

      {listing.kind === 'auction' && (
        <section className="card">
          <h2>Bid history</h2>
          <BidHistory bids={listing.bids} />
        </section>
      )}
    </div>
  )
}
