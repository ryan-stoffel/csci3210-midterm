import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { marketApi, tradeApi } from '../api/market'
import { Field } from '../components/Field'
import { ItemName } from '../components/ItemName'
import { Status } from '../components/Status'
import { useToast } from '../context/ToastContext'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'
import type { InventoryItem } from '../types'

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function ItemPicker({ title, items, picked, onToggle }: {
  title: string; items: InventoryItem[]; picked: Set<number>; onToggle: (id: number) => void
}) {
  return (
    <fieldset className="card picker">
      <legend>{title}</legend>
      {items.length === 0 && <p className="muted small">No tradable items.</p>}
      {items.map((i) => (
        <label key={i.id} className="check">
          <input type="checkbox" checked={picked.has(i.id)} onChange={() => onToggle(i.id)} />
          <ItemName type={i.item_type} showRarity />
        </label>
      ))}
    </fieldset>
  )
}

export function NewTradePage() {
  const navigate = useNavigate()
  const notify = useToast()
  const players = useAsync(tradeApi.players, [])
  const mine = useAsync(marketApi.inventory, [])
  const [recipient, setRecipient] = useState('')
  const [offered, setOffered] = useState<Set<number>>(new Set())
  const [requested, setRequested] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const propose = useAction(tradeApi.propose)

  if (!players.data || !mine.data) {
    return <Status loading={players.loading || mine.loading} error={players.error ?? mine.error} />
  }
  const target = players.data.find((p) => p.username === recipient)
  const myTradable = mine.data.filter((i) => i.active_listing_id === null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trade = await propose.run({ recipient, offered_item_ids: [...offered], requested_item_ids: [...requested], message })
    if (!trade) return
    notify('success', `Offer sent to ${trade.recipient}.`)
    navigate('/trades?box=outgoing')
  }

  return (
    <form onSubmit={submit}>
      <p><Link to="/trades">← Back to trades</Link></p>
      <h1>New trade offer</h1>
      <Field label="Trade with" error={propose.fieldErrors.recipient}>
        <select required value={recipient} onChange={(e) => { setRecipient(e.target.value); setRequested(new Set()) }}>
          <option value="">Choose a player</option>
          {players.data.map((p) => <option key={p.id} value={p.username}>{p.username}</option>)}
        </select>
      </Field>
      <div className="trade-sides">
        <ItemPicker title="You give" items={myTradable} picked={offered} onToggle={(id) => setOffered((s) => toggle(s, id))} />
        <ItemPicker title={target ? `You get from ${target.username}` : 'You get'} items={target?.items ?? []}
          picked={requested} onToggle={(id) => setRequested((s) => toggle(s, id))} />
      </div>
      {(propose.fieldErrors.offered_item_ids || propose.fieldErrors.requested_item_ids) && (
        <p className="field-error" role="alert">{propose.fieldErrors.offered_item_ids ?? propose.fieldErrors.requested_item_ids}</p>
      )}
      <Field label="Message (optional)" error={propose.fieldErrors.message}>
        <input maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <button type="submit" disabled={propose.pending || !recipient || offered.size + requested.size === 0}>Send offer</button>
    </form>
  )
}
