// Shapes of every API payload. Mirrors backend/market/serializers.py.

export type Category = 'weapon' | 'armor' | 'skin' | 'resource' | 'consumable'
export type Rarity = 1 | 2 | 3 | 4 | 5
export type ListingKind = 'fixed' | 'auction'
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired'
export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type LedgerKind = 'grant' | 'bid_hold' | 'bid_refund' | 'purchase' | 'sale' | 'auction_won' | 'trade'
export type ListingSort = 'newest' | 'price_asc' | 'price_desc' | 'ending_soon' | 'rarity'

export interface User {
  id: number
  username: string
  is_staff: boolean
  gold: number
  held_gold: number
}

export interface Session {
  token: string
  user: User
}

export interface ItemType {
  id: number
  name: string
  category: Category
  rarity: Rarity
  description: string
  base_value: number
}

export interface InventoryItem {
  id: number
  item_type: ItemType
  acquired_at: string
  active_listing_id: number | null
}

export interface Player {
  id: number
  username: string
  items: InventoryItem[]
}

export interface Bid {
  id: number
  bidder: string
  amount: number
  created_at: string
}

export interface Listing {
  id: number
  item: InventoryItem
  seller: string
  buyer: string | null
  kind: ListingKind
  status: ListingStatus
  price: number
  current_price: number
  bid_count: number
  top_bidder: string | null
  min_next_bid: number | null
  created_at: string
  ends_at: string | null
  closed_at: string | null
}

export interface ListingDetail extends Listing {
  bids: Bid[]
}

export interface ListingFilters {
  q?: string
  category?: Category
  min_rarity?: Rarity
  kind?: ListingKind
  status?: ListingStatus
  min_price?: number
  max_price?: number
  mine?: boolean
  sort?: ListingSort
  page?: number
}

export interface NewListing {
  item_id: number
  kind: ListingKind
  price: number
  duration_hours: number | null
}

export interface TradeOffer {
  id: number
  sender: string
  recipient: string
  offered_items: InventoryItem[]
  requested_items: InventoryItem[]
  message: string
  status: TradeStatus
  created_at: string
  resolved_at: string | null
}

export interface NewTrade {
  recipient: string
  offered_item_ids: number[]
  requested_item_ids: number[]
  message: string
}

export interface LedgerEntry {
  id: number
  kind: LedgerKind
  amount: number
  balance_after: number
  note: string
  listing: number | null
  trade: number | null
  created_at: string
}

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
