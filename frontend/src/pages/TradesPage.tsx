import { Link, useSearchParams } from 'react-router-dom'
import { tradeApi } from '../api/market'
import { Status } from '../components/Status'
import { TradeCard } from '../components/TradeCard'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'
import type { TradeOffer } from '../types'

export function TradesPage() {
  const user = useUser()
  const notify = useToast()
  const [params, setParams] = useSearchParams()
  const box = params.get('box') === 'outgoing' ? 'outgoing' : 'incoming'
  const { data: trades, error, loading, reload } = useAsync(() => tradeApi.list(box), [box])

  const respond = useAction(async (call: (id: number) => Promise<TradeOffer>, id: number, message: string) => {
    await call(id)
    notify('success', message)
  })
  const act = async (call: (id: number) => Promise<TradeOffer>, id: number, message: string) => {
    await respond.run(call, id, message)
    reload() // reload on success and on failure, since a 409 means the offer changed
  }

  return (
    <div>
      <div className="row spread">
        <h1>Trade offers</h1>
        <Link className="button" to="/trades/new">New offer</Link>
      </div>
      <div className="tabs" role="tablist">
        {(['incoming', 'outgoing'] as const).map((b) => (
          <button key={b} type="button" role="tab" aria-selected={box === b} className={box === b ? 'tab active' : 'tab'}
            onClick={() => setParams({ box: b })}>
            {b === 'incoming' ? 'Incoming' : 'Outgoing'}
          </button>
        ))}
      </div>
      <Status loading={loading && !trades} error={error} onRetry={reload} />
      {trades?.length === 0 && <p className="empty">No {box} offers.</p>}
      <div className="stack">
        {trades?.map((t) => (
          <TradeCard key={t.id} trade={t} viewer={user.username} actions={t.status !== 'pending' ? null : box === 'incoming' ? (
            <>
              <button type="button" disabled={respond.pending} onClick={() => act(tradeApi.accept, t.id, 'Trade accepted. Items swapped.')}>Accept</button>
              <button type="button" className="secondary" disabled={respond.pending} onClick={() => act(tradeApi.decline, t.id, 'Offer declined.')}>Decline</button>
            </>
          ) : (
            <button type="button" className="secondary" disabled={respond.pending} onClick={() => act(tradeApi.cancel, t.id, 'Offer withdrawn.')}>Withdraw</button>
          )} />
        ))}
      </div>
    </div>
  )
}
