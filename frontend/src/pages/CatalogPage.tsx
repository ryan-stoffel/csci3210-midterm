import { useState, type FormEvent } from 'react'
import { marketApi } from '../api/market'
import { Field } from '../components/Field'
import { ItemName } from '../components/ItemName'
import { Status } from '../components/Status'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATEGORIES, RARITY_NAMES, capitalize, gold } from '../format'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'
import type { Category, ItemType, Rarity } from '../types'

const EMPTY: Omit<ItemType, 'id'> = { name: '', category: 'weapon', rarity: 1, description: '', base_value: 10 }

/** Staff-only form. The API enforces the same rule with IsAdminOrReadOnly. */
function NewItemTypeForm({ onCreated }: { onCreated: () => void }) {
  const [draft, setDraft] = useState(EMPTY)
  const notify = useToast()
  const create = useAction(marketApi.createItemType)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const created = await create.run(draft)
    if (!created) return
    notify('success', `${created.name} added to the catalog.`)
    setDraft(EMPTY)
    onCreated()
  }

  return (
    <form className="card row wrap" onSubmit={submit} aria-label="Add item type">
      <Field label="Name" error={create.fieldErrors.name}>
        <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label="Category" error={create.fieldErrors.category}>
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
        </select>
      </Field>
      <Field label="Rarity" error={create.fieldErrors.rarity}>
        <select value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: Number(e.target.value) as Rarity })}>
          {([1, 2, 3, 4, 5] as const).map((r) => <option key={r} value={r}>{RARITY_NAMES[r]}</option>)}
        </select>
      </Field>
      <Field label="Base value" error={create.fieldErrors.base_value}>
        <input type="number" min={1} required value={draft.base_value} onChange={(e) => setDraft({ ...draft, base_value: Number(e.target.value) })} />
      </Field>
      <Field label="Description" error={create.fieldErrors.description}>
        <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </Field>
      <button type="submit" disabled={create.pending}>Add item type</button>
    </form>
  )
}

export function CatalogPage() {
  const user = useUser()
  const { data, error, loading, reload } = useAsync(marketApi.itemTypes, [])

  return (
    <div>
      <h1>Item catalog</h1>
      {user.is_staff && <NewItemTypeForm onCreated={reload} />}
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Item</th><th scope="col">Rarity</th><th scope="col">Category</th><th scope="col" className="num">Base value</th><th scope="col">Description</th></tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td><ItemName type={t} /></td>
                  <td>{RARITY_NAMES[t.rarity]}</td>
                  <td>{capitalize(t.category)}</td>
                  <td className="num">{gold(t.base_value)}</td>
                  <td className="muted">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
