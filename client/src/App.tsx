import { useState, useEffect } from 'react'
import { useStore, findUmbrella } from './store/useStore'
import type { Umbrella } from './types/umbrella'
import Dashboard from './components/Dashboard'
import Chat from './components/Chat'
import UmbrellaDetail from './components/UmbrellaDetail'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

type Tab = 'dashboard' | 'chat'

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
  const umbrellas = useStore(s => s.umbrellas)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>({ loading: true, authenticated: false })

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { authenticated: boolean; user?: AuthUser }) => {
        setAuth({ loading: false, authenticated: data.authenticated, user: data.user })
      })
      .catch(() => setAuth({ loading: false, authenticated: false }))
  }, [])

  const selected = selectedId ? findUmbrella(umbrellas, selectedId) : null

  function handleSelect(u: Umbrella) {
    setSelectedId(u.id)
    setTab('dashboard')
  }

  function handleBack() {
    if (!selected) return
    const parent = selected.parentId ? findUmbrella(umbrellas, selected.parentId) : null
    setSelectedId(parent?.id ?? null)
  }

  // Auth loading
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not authenticated — show login screen
  if (!auth.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white px-6">
        <p className="text-5xl mb-6">🌂</p>
        <h1 className="text-2xl font-bold mb-2">MyNefesh</h1>
        <p className="text-zinc-400 text-sm mb-10">Your personal AI life secretary</p>
        <button
          onClick={() => { window.location.href = `${API_BASE}/auth/github` }}
          className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Login with GitHub
        </button>
      </div>
    )
  }

  // Authenticated — render app
  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto">
      <div className="flex-1 overflow-hidden relative">
        {tab === 'dashboard' && (
          <div className="h-full overflow-y-auto">
            {selected ? (
              <div className="pb-20">
                <UmbrellaDetail
                  umbrella={selected}
                  onBack={handleBack}
                  onSelectChild={handleSelect}
                />
              </div>
            ) : (
              <div className="pb-20">
                <Dashboard onSelect={handleSelect} user={auth.user} />
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="h-full pb-16">
            <Chat />
          </div>
        )}
      </div>

      <nav className="shrink-0 fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-zinc-900/95 backdrop-blur border-t border-zinc-800 flex">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            tab === 'dashboard' ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="text-xl">🏠</span>
          Dashboard
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            tab === 'chat' ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="text-xl">💬</span>
          Chat
        </button>
      </nav>
    </div>
  )
}
