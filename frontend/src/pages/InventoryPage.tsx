import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { marketApi } from '../api/market'
import { ItemCard } from '../components/ItemCard'
import { SellForm } from '../components/SellForm'
import { Status } from '../components/Status'
import { useToast } from '../context/ToastContext'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'

export function InventoryPage() {
  const { data: items, error, loading, reload } = useAsync(marketApi.inventory, [])
  const [sellingId, setSellingId] = useState<number | null>(null)
  const notify = useToast()
  const navigate = useNavigate()
  const create = useAction(marketApi.createListing)

  if (!items) return <Status loading={loading} error={error} onRetry={reload} />
  const selling = items.find((i) => i.id === sellingId)

  return (
    <div>
      <h1>Inventory <span className="muted small">{items.length} items</span></h1>
      {selling && (
        <SellForm key={selling.id} item={selling} pending={create.pending} errors={create.fieldErrors}
          onClose={() => setSellingId(null)}
          onSubmit={async (body) => {
            const listing = await create.run(body)
            if (!listing) return
            notify('success', `${selling.item_type.name} is now on the market.`)
            navigate(`/listings/${listing.id}`)
          }} />
      )}
      {items.length === 0 && <p className="empty">Your inventory is empty. Win an auction or accept a trade to get items.</p>}
      <div className="grid">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} selected={item.id === sellingId} actions={
            item.active_listing_id
              ? <Link className="pill pill-active" to={`/listings/${item.active_listing_id}`}>Listed · view</Link>
              : <button type="button" onClick={() => setSellingId(item.id)}>Sell</button>
          } />
        ))}
      </div>
    </div>
  )
}
