import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { AuthPage } from './pages/AuthPage'
import { CatalogPage } from './pages/CatalogPage'
import { HistoryPage } from './pages/HistoryPage'
import { InventoryPage } from './pages/InventoryPage'
import { ListingPage } from './pages/ListingPage'
import { MarketPage } from './pages/MarketPage'
import { NewTradePage } from './pages/NewTradePage'
import { TradesPage } from './pages/TradesPage'

function RequireAuth() {
  const { user, restoring } = useAuth()
  if (restoring) return <p className="muted center">Loading…</p>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function NotFound() {
  return (
    <div className="card">
      <h1>Page not found</h1>
      <Link to="/">Back to the market</Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<MarketPage />} />
                <Route path="listings/:id" element={<ListingPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="trades" element={<TradesPage />} />
                <Route path="trades/new" element={<NewTradePage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
