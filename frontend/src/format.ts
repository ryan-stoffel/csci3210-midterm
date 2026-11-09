import type { Category, LedgerKind, Rarity } from './types'

export const RARITY_NAMES: Record<Rarity, string> = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' }
export const CATEGORIES: Category[] = ['weapon', 'armor', 'skin', 'resource', 'consumable']
export const LEDGER_LABELS: Record<LedgerKind, string> = {
  grant: 'Grant', bid_hold: 'Bid held', bid_refund: 'Bid refund', purchase: 'Purchase', sale: 'Sale',
  auction_won: 'Auction won', trade: 'Trade',
}

export const gold = (n: number): string => `${n.toLocaleString()}g`
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** "2h 14m", "45s", or "Ended" for a future ISO time. */
export function timeLeft(iso: string, now: number): string {
  const s = Math.floor((new Date(iso).getTime() - now) / 1000)
  if (s <= 0) return 'Ended'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}
