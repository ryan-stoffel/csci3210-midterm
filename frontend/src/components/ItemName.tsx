import { RARITY_NAMES } from '../format'
import type { ItemType } from '../types'

/** Item name colored by rarity, with the rarity spelled out for screen readers and color-blind players. */
export function ItemName({ type, showRarity = false }: { type: ItemType; showRarity?: boolean }) {
  return (
    <span className={`item-name rarity-${type.rarity}`}>
      {type.name}
      {showRarity ? <span className="rarity-tag">{RARITY_NAMES[type.rarity]}</span> : (
        <span className="sr-only"> ({RARITY_NAMES[type.rarity]})</span>
      )}
    </span>
  )
}
