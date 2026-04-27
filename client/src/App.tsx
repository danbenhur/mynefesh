import { useState } from 'react'
import { useStore, findUmbrella } from './store/useStore'
import type { Umbrella } from './types/umbrella'
import Dashboard from './components/Dashboard'
import Chat from './components/Chat'
import UmbrellaDetail from './components/UmbrellaDetail'

type Tab = 'dashboard' | 'chat'

export default function App() {
  const umbrellas = useStore(s => s.umbrellas)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = selectedId ? findUmbrella(umbrellas, selectedId) : null

  function handleSelect(u: Umbrella) {
    setSelectedId(u.id)
    setTab('dashboard')
  }

  function handleBack() {
    // if child, go to parent; otherwise go to dashboard root
    if (!selected) return
    const parent = selected.parentId ? findUmbrella(umbrellas, selected.parentId) : null
    setSelectedId(parent?.id ?? null)
  }

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
                <Dashboard onSelect={handleSelect} />
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
