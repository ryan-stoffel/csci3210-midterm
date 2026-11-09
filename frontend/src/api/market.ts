// One function per backend endpoint. Components call these, never fetch directly.

import { request } from './client'
import type {
  InventoryItem, ItemType, LedgerEntry, Listing, ListingDetail, ListingFilters, NewListing, NewTrade, Page,
  Player, Session, TradeOffer, User,
} from '../types'

function query(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const authApi = {
  login: (username: string, password: string) => request<Session>('/auth/login/', 'POST', { username, password }),
  register: (username: string, password: string) => request<Session>('/auth/register/', 'POST', { username, password }),
  logout: () => request<void>('/auth/logout/', 'POST'),
  me: () => request<User>('/me/'),
}

export const marketApi = {
  listings: (filters: ListingFilters) => request<Page<Listing>>(`/listings/${query(filters)}`),
  listing: (id: number) => request<ListingDetail>(`/listings/${id}/`),
  createListing: (body: NewListing) => request<ListingDetail>('/listings/', 'POST', body),
  bid: (id: number, amount: number) => request<ListingDetail>(`/listings/${id}/bid/`, 'POST', { amount }),
  buy: (id: number) => request<ListingDetail>(`/listings/${id}/buy/`, 'POST'),
  cancel: (id: number) => request<ListingDetail>(`/listings/${id}/cancel/`, 'POST'),
  inventory: () => request<InventoryItem[]>('/inventory/'),
  itemTypes: () => request<ItemType[]>('/item-types/'),
  createItemType: (body: Omit<ItemType, 'id'>) => request<ItemType>('/item-types/', 'POST', body),
  history: (page: number) => request<Page<LedgerEntry>>(`/transactions/${query({ page })}`),
}

export const tradeApi = {
  list: (box: 'incoming' | 'outgoing') => request<TradeOffer[]>(`/trades/${query({ box })}`),
  players: () => request<Player[]>('/players/'),
  propose: (body: NewTrade) => request<TradeOffer>('/trades/', 'POST', body),
  accept: (id: number) => request<TradeOffer>(`/trades/${id}/accept/`, 'POST'),
  decline: (id: number) => request<TradeOffer>(`/trades/${id}/decline/`, 'POST'),
  cancel: (id: number) => request<TradeOffer>(`/trades/${id}/cancel/`, 'POST'),
}
