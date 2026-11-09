interface Props {
  page: number
  count: number
  pageSize: number
  onPage: (page: number) => void
}

export function Pager({ page, count, pageSize, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages === 1) return null
  return (
    <nav className="row pager" aria-label="Pagination">
      <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  )
}
