import { useState, useEffect } from 'react'
import { T } from './lib/theme'
import BottomNav, { type NavScreen } from './components/BottomNav'
import HomeScreen from './components/HomeScreen'
import UmbrellaDetail from './components/UmbrellaDetail'
import ChatScreen from './components/ChatScreen'
import CheckinScreen from './components/CheckinScreen'
import ProfileScreen from './components/ProfileScreen'
import SettingsScreen from './components/SettingsScreen'
import InterviewScreen from './components/InterviewScreen'
import ArchivedScreen from './components/ArchivedScreen'
import { useStore, findUmbrella } from './store/useStore'
import type { AppScreen, ScreenData } from './types/nav'

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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

export default function App() {
  const [navStack, setNavStack] = useState<NavEntry[]>([{ screen: 'home', data: {} }])
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')
  const [auth, setAuth] = useState<AuthState>({ loading: true, authenticated: false })
  const { umbrellas, loadUmbrellas } = useStore()

  const current = navStack[navStack.length - 1]

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        setAuth({ loading: false, authenticated: data.authenticated, user: data.user })
      })
      .catch(() => setAuth({ loading: false, authenticated: false }))
  }, [])

  useEffect(() => {
    if (auth.authenticated) loadUmbrellas()
  }, [auth.authenticated])

  // Hash-based deep link: #/interview routes straight to the interview screen
  useEffect(() => {
    if (!auth.authenticated) return
    if (window.location.hash === '#/interview') {
      navigate('interview')
      // Clear the hash so navigating back works cleanly
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [auth.authenticated])

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
    if (current.screen === 'umbrella') return 'umbrellas'
    if (current.screen === 'settings') return 'profile'
    if (current.screen === 'interview') return 'home'
    if (current.screen === 'archived') return 'home'
    return current.screen as NavScreen
  }

  const selectedUmbrella = current.screen === 'umbrella' && current.data.umbrellaId
    ? findUmbrella(umbrellas, current.data.umbrellaId)
    : null

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
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    const gotEmail = params.get('got')
    const expectedEmail = params.get('expected')

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
        {authError && (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            fontSize: 12, color: '#664d03', maxWidth: 320, textAlign: 'left',
          }}>
            {authError === 'email-mismatch' && (<>
              <strong>Login blocked — email mismatch</strong><br />
              Google returned: <code>{gotEmail}</code><br />
              Server expected: <code>{expectedEmail}</code>
            </>)}
            {authError === 'login-failed' && (<>
              <strong>Login failed (req.login error)</strong><br />
              <code>{params.get('detail')}</code>
            </>)}
            {authError === 'session-save-failed' && (<>
              <strong>Session save failed</strong><br />
              <code>{params.get('detail')}</code>
            </>)}
            {!['email-mismatch','login-failed','session-save-failed'].includes(authError) && (<>
              <strong>Auth error: {authError}</strong>
            </>)}
          </div>
        )}
        <button
          onClick={() => { window.location.href = `${API_BASE}/auth/google` }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#fff', color: '#3c4043',
            padding: '12px 24px', borderRadius: 24,
            border: '1px solid #dadce0', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          <svg height="20" width="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.7c4.5-4.2 7-10.3 7-17.2z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9H2.5v6.2C6.5 42.6 14.7 48 24 48z"/>
            <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6v-6.2H2.5C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.8l8-6.2z"/>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.3 30.5 0 24 0 14.7 0 6.5 5.4 2.5 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/>
          </svg>
          Sign in with Google
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
        {current.screen === 'home' && <HomeScreen navigate={navigate} />}

        {current.screen === 'umbrellas' && <HomeScreen navigate={navigate} />}

        {current.screen === 'umbrella' && selectedUmbrella && (
          <UmbrellaDetail umbrella={selectedUmbrella} navigate={navigate} goBack={goBack} />
        )}

        {current.screen === 'chat' && <ChatScreen />}

        {current.screen === 'checkin' && <CheckinScreen navigate={navigate} />}

        {current.screen === 'profile' && <ProfileScreen user={auth.user} navigate={navigate} />}

        {current.screen === 'settings' && <SettingsScreen navigate={navigate} goBack={goBack} />}

        {current.screen === 'interview' && <InterviewScreen navigate={navigate} />}

        {current.screen === 'archived' && <ArchivedScreen navigate={navigate} goBack={goBack} />}
      </div>

      <BottomNav
        active={activeNavScreen()}
        onNavigate={(s) => navigate(s)}
      />
    </div>
  )
}
