import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketApi } from '../api/market'
import { FilterPanel } from '../components/FilterPanel'
import { ListingTable } from '../components/ListingTable'
import { Pager } from '../components/Pager'
import { Status } from '../components/Status'
import { useAsync } from '../hooks/useAsync'
import type { Category, ListingFilters, ListingKind, ListingSort, ListingStatus, Rarity } from '../types'

const PAGE_SIZE = 20
const SORTS: [ListingSort, string][] = [
  ['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'],
  ['ending_soon', 'Ending soon'], ['rarity', 'Rarity'],
]

function readFilters(p: URLSearchParams): ListingFilters {
  const num = (k: string) => (p.has(k) ? Number(p.get(k)) : undefined)
  return {
    q: p.get('q') ?? undefined,
    category: (p.get('category') as Category | null) ?? undefined,
    min_rarity: num('min_rarity') as Rarity | undefined,
    kind: (p.get('kind') as ListingKind | null) ?? undefined,
    status: (p.get('status') as ListingStatus | null) ?? undefined,
    min_price: num('min_price'),
    max_price: num('max_price'),
    mine: p.get('mine') === 'true' || undefined,
    sort: (p.get('sort') as ListingSort | null) ?? undefined,
    page: num('page'),
  }
}

/** Filters live in the URL so a filtered view can be shared or bookmarked. */
export function MarketPage() {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const filters = useMemo(() => readFilters(new URLSearchParams(key)), [key])
  const { data, error, loading, reload } = useAsync(() => marketApi.listings(filters), [filters])

  const apply = (next: ListingFilters) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== '') p.set(k, String(v))
    setParams(p)
  }

  return (
    <div className="market">
      <FilterPanel key={key} value={filters} onApply={apply} />
      <section>
        <div className="row spread">
          <h1>Marketplace {data && <span className="muted small">{data.count} listings</span>}</h1>
          <label className="inline">
            Sort
            <select value={filters.sort ?? 'newest'} onChange={(e) => apply({ ...filters, sort: e.target.value as ListingSort, page: undefined })}>
              {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </div>
        <Status loading={loading && !data} error={error} onRetry={reload} />
        {data && <ListingTable listings={data.results} />}
        {data && <Pager page={filters.page ?? 1} count={data.count} pageSize={PAGE_SIZE} onPage={(page) => apply({ ...filters, page })} />}
      </section>
    </div>
  )
}
