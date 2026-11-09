import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, useUser } from '../context/AuthContext'
import { gold } from '../format'
import { ErrorBoundary } from './ErrorBoundary'

const LINKS = [
  ['/', 'Market'],
  ['/inventory', 'Inventory'],
  ['/trades', 'Trades'],
  ['/history', 'History'],
  ['/catalog', 'Catalog'],
] as const

export function Layout() {
  const user = useUser()
  const { logout } = useAuth()
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <span className="brand">Trading Hub</span>
        <nav aria-label="Main">
          {LINKS.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <div className="wallet" aria-label="Wallet">
          <span className="gold-amount">{gold(user.gold)}</span>
          {user.held_gold > 0 && <span className="muted small">{gold(user.held_gold)} held in bids</span>}
          <span className="muted">{user.username}{user.is_staff && ' (admin)'}</span>
          <button type="button" className="secondary" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main id="main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </>
  )
}
