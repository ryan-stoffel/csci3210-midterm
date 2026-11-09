import { useState } from 'react'
import { marketApi } from '../api/market'
import { Pager } from '../components/Pager'
import { Status } from '../components/Status'
import { LEDGER_LABELS, dateTime, gold } from '../format'
import { useAsync } from '../hooks/useAsync'

export function HistoryPage() {
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useAsync(() => marketApi.history(page), [page])

  return (
    <div>
      <h1>Transaction history</h1>
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data?.count === 0 && <p className="empty">No transactions yet.</p>}
      {data && data.count > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th><th scope="col">Type</th><th scope="col">Details</th>
                <th scope="col" className="num">Gold</th><th scope="col" className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((t) => (
                <tr key={t.id}>
                  <td>{dateTime(t.created_at)}</td>
                  <td>{LEDGER_LABELS[t.kind]}</td>
                  <td>{t.note}</td>
                  <td className={`num ${t.amount > 0 ? 'plus' : t.amount < 0 ? 'minus' : ''}`}>
                    {t.amount === 0 ? '—' : `${t.amount > 0 ? '+' : '−'}${gold(Math.abs(t.amount))}`}
                  </td>
                  <td className="num">{gold(t.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} count={data.count} pageSize={20} onPage={setPage} />}
    </div>
  )
}
