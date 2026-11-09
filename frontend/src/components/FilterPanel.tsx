import { useState, type FormEvent } from 'react'
import { CATEGORIES, RARITY_NAMES, capitalize } from '../format'
import type { Category, ListingFilters, ListingKind, ListingStatus, Rarity } from '../types'

interface Props {
  value: ListingFilters
  onApply: (filters: ListingFilters) => void
}

const RARITIES = [1, 2, 3, 4, 5] as const
const STATUSES: ListingStatus[] = ['active', 'sold', 'expired', 'cancelled']

/** Marketplace filters. Edits a local draft and only reports it on Apply, so typing does not refetch. */
export function FilterPanel({ value, onApply }: Props) {
  const [draft, setDraft] = useState<ListingFilters>(value)
  const set = (patch: Partial<ListingFilters>) => setDraft((d) => ({ ...d, ...patch }))
  const num = (s: string): number | undefined => (s === '' ? undefined : Number(s))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onApply({ ...draft, page: undefined })
  }
  const reset = () => {
    setDraft({})
    onApply({})
  }

  return (
    <form className="card filters" onSubmit={submit} aria-label="Filter listings">
      <label>
        Search
        <input type="search" placeholder="Item name" value={draft.q ?? ''} onChange={(e) => set({ q: e.target.value })} />
      </label>
      <label>
        Category
        <select value={draft.category ?? ''} onChange={(e) => set({ category: (e.target.value || undefined) as Category | undefined })}>
          <option value="">All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
        </select>
      </label>
      <label>
        Min rarity
        <select value={draft.min_rarity ?? ''} onChange={(e) => set({ min_rarity: (num(e.target.value) as Rarity | undefined) })}>
          <option value="">Any</option>
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_NAMES[r]}</option>)}
        </select>
      </label>
      <label>
        Type
        <select value={draft.kind ?? ''} onChange={(e) => set({ kind: (e.target.value || undefined) as ListingKind | undefined })}>
          <option value="">All</option>
          <option value="fixed">Buy now</option>
          <option value="auction">Auction</option>
        </select>
      </label>
      <fieldset className="row">
        <legend>Price (gold)</legend>
        <input type="number" min={0} aria-label="Minimum price" placeholder="Min" value={draft.min_price ?? ''} onChange={(e) => set({ min_price: num(e.target.value) })} />
        <input type="number" min={0} aria-label="Maximum price" placeholder="Max" value={draft.max_price ?? ''} onChange={(e) => set({ max_price: num(e.target.value) })} />
      </fieldset>
      <label>
        Status
        <select value={draft.status ?? 'active'} onChange={(e) => set({ status: e.target.value as ListingStatus })}>
          {STATUSES.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={draft.mine ?? false} onChange={(e) => set({ mine: e.target.checked || undefined })} />
        Only my listings
      </label>
      <div className="row">
        <button type="submit">Apply</button>
        <button type="button" className="secondary" onClick={reset}>Reset</button>
      </div>
    </form>
  )
}
