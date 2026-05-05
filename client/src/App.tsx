import { useState, useEffect } from 'react'
import { T } from './lib/theme'
import BottomNav, { type NavScreen } from './components/BottomNav'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

type AppScreen = NavScreen | 'umbrella'

interface ScreenData {
  umbrellaId?: string
}

interface NavEntry {
  screen: AppScreen
  data: ScreenData
}

interface AuthUser {
  id: string
  username: string
  displayName: string
  avatar?: string
}

interface AuthState {
  loading: boolean
  authenticated: boolean
  user?: AuthUser
}

export default function App() {
  const [navStack, setNavStack] = useState<NavEntry[]>([{ screen: 'home', data: {} }])
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')
  const [auth, setAuth] = useState<AuthState>({ loading: true, authenticated: false })

  const current = navStack[navStack.length - 1]

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        setAuth({ loading: false, authenticated: data.authenticated, user: data.user })
      })
      .catch(() => setAuth({ loading: false, authenticated: false }))
  }, [])

  function navigate(s: AppScreen, data?: ScreenData) {
    setAnimDir('forward')
    setNavStack(stack => [...stack, { screen: s, data: data ?? {} }])
  }

  function goBack() {
    if (navStack.length <= 1) return
    setAnimDir('back')
    setNavStack(stack => stack.slice(0, -1))
  }

  function activeNavScreen(): NavScreen {
    return current.screen === 'umbrella' ? 'umbrellas' : current.screen
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  if (auth.loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: T.bg,
      }}>
        <div style={{
          width: 32, height: 32,
          border: `2px solid ${T.sage}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (!auth.authenticated) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: T.bg, padding: '0 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 56, marginBottom: 24 }}>🌿</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>myNefesh</h1>
        <p style={{ fontSize: 14, color: T.charcoalLight, marginBottom: 48 }}>
          Your personal AI life secretary
        </p>
        <button
          onClick={() => { window.location.href = `${API_BASE}/auth/github` }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: T.charcoal, color: '#fff',
            padding: '14px 28px', borderRadius: 16,
            border: 'none', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Login with GitHub
        </button>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto',
      height: '100vh', position: 'relative', overflow: 'hidden',
    }}>
      <div
        key={`${current.screen}-${navStack.length}`}
        className={animDir === 'forward' ? 'screen-enter' : 'screen-back-enter'}
        style={{ height: '100%', overflowY: 'auto', paddingBottom: 82 }}
      >
        {current.screen === 'home' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <p style={{ color: T.charcoalLight, fontSize: 14 }}>HomeScreen coming next</p>
          </div>
        )}

        {current.screen === 'umbrellas' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <p style={{ color: T.charcoalLight, fontSize: 14 }}>UmbrellasScreen coming next</p>
          </div>
        )}

        {current.screen === 'umbrella' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <button
              onClick={goBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sage, fontSize: 14, fontFamily: 'inherit', marginBottom: 16 }}
            >
              ← Back
            </button>
            <p style={{ color: T.charcoalLight, fontSize: 14 }}>
              UmbrellaDetail coming next — id: {current.data.umbrellaId}
            </p>
          </div>
        )}

        {current.screen === 'chat' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <p style={{ color: T.charcoalLight, fontSize: 14 }}>ChatScreen coming next</p>
          </div>
        )}

        {current.screen === 'checkin' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <p style={{ color: T.charcoalLight, fontSize: 14 }}>CheckinScreen coming next</p>
          </div>
        )}

        {current.screen === 'profile' && (
          <div style={{ padding: '64px 20px 20px' }}>
            <p style={{ color: T.charcoalLight, fontSize: 14, marginBottom: 20 }}>
              ProfileScreen coming next — {auth.user?.displayName}
            </p>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.red, fontSize: 14, fontFamily: 'inherit',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <BottomNav
        active={activeNavScreen()}
        onNavigate={(s) => navigate(s)}
      />
    </div>
  )
}
