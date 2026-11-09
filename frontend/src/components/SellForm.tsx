import { useState, type FormEvent } from 'react'
import { gold } from '../format'
import type { InventoryItem, ListingKind, NewListing } from '../types'
import { Field } from './Field'
import { ItemName } from './ItemName'

interface Props {
  item: InventoryItem
  pending: boolean
  errors: Record<string, string>
  onSubmit: (listing: NewListing) => void
  onClose: () => void
}

export function SellForm({ item, pending, errors, onSubmit, onClose }: Props) {
  const [kind, setKind] = useState<ListingKind>('fixed')
  const [price, setPrice] = useState(String(item.item_type.base_value))
  const [hours, setHours] = useState('24')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ item_id: item.id, kind, price: Number(price), duration_hours: kind === 'auction' ? Number(hours) : null })
  }

  return (
    <form className="card sell-form" onSubmit={submit} aria-label="Create listing">
      <h2>Sell <ItemName type={item.item_type} /></h2>
      <p className="muted small">Base value {gold(item.item_type.base_value)}</p>
      <fieldset className="row">
        <legend>Listing type</legend>
        <label className="check"><input type="radio" name="kind" checked={kind === 'fixed'} onChange={() => setKind('fixed')} /> Buy now</label>
        <label className="check"><input type="radio" name="kind" checked={kind === 'auction'} onChange={() => setKind('auction')} /> Auction</label>
      </fieldset>
      <Field label={kind === 'fixed' ? 'Price (gold)' : 'Opening bid (gold)'} error={errors.price}>
        <input type="number" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      {kind === 'auction' && (
        <Field label="Duration (hours, 1-72)" error={errors.duration_hours}>
          <input type="number" min={1} max={72} required value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
      )}
      <div className="row">
        <button type="submit" disabled={pending}>List item</button>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </form>
  )
}
