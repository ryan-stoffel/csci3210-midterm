import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { useAction } from '../hooks/useAction'

/** Sign-in and registration share one form. `mode` picks the endpoint and copy. */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { run, pending, fieldErrors } = useAction(mode === 'login' ? auth.login : auth.register)

  if (auth.user) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(username, password)
  }

  const isLogin = mode === 'login'
  return (
    <main id="main" className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Trading Hub</h1>
        <p className="muted">{isLogin ? 'Sign in to trade.' : 'New players start with 1,000 gold and three items.'}</p>
        <Field label="Username" error={fieldErrors.username}>
          <input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          <input type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button type="submit" disabled={pending}>{isLogin ? 'Sign in' : 'Create account'}</button>
        <p className="small">
          {isLogin ? <>No account? <Link to="/register">Register</Link></> : <>Have an account? <Link to="/login">Sign in</Link></>}
        </p>
      </form>
    </main>
  )
}
