import type { ReactNode } from 'react'
import { capitalize, gold } from '../format'
import type { InventoryItem } from '../types'
import { ItemName } from './ItemName'

interface Props {
  item: InventoryItem
  /** Buttons or links rendered at the bottom of the card. */
  actions?: ReactNode
  selected?: boolean
}

export function ItemCard({ item, actions, selected = false }: Props) {
  const t = item.item_type
  return (
    <article className={`card item-card border-rarity-${t.rarity}${selected ? ' selected' : ''}`}>
      <ItemName type={t} showRarity />
      <p className="muted small">{capitalize(t.category)} · base {gold(t.base_value)}</p>
      <p className="small">{t.description}</p>
      {actions && <div className="card-actions">{actions}</div>}
    </article>
  )
}
