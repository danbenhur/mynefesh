import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Umbrella } from '../types/umbrella'
import UmbrellaCard from './UmbrellaCard'

interface Props {
  onSelect: (u: Umbrella) => void
}

function overallScore(umbrellas: Umbrella[]) {
  if (!umbrellas.length) return 0
  return Math.round(umbrellas.reduce((sum, u) => sum + u.healthScore, 0) / umbrellas.length)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const ICON_PICKS = ['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼']

export default function Dashboard({ onSelect }: Props) {
  const { umbrellas, loading, error, loadUmbrellas, addUmbrella } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🏠')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadUmbrellas()
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    await addUmbrella(newName.trim(), newIcon)
    setNewName('')
    setNewIcon('🏠')
    setShowCreate(false)
    setCreating(false)
  }

  const overall = overallScore(umbrellas)
  const urgentReminders = umbrellas.flatMap(u => u.reminders).filter(r => {
    const diff = (new Date(r.triggerDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff <= 3
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-zinc-400 text-sm mb-1">{greeting()}, Dan 👋</p>
            <h1 className="text-2xl font-bold tracking-tight">MyNefesh</h1>
          </div>
          {umbrellas.length > 0 && (
            <div className="text-right">
              <p className="text-zinc-400 text-xs mb-1">Overall health</p>
              <p
                className="text-3xl font-bold"
                style={{ color: overall >= 75 ? '#22c55e' : overall >= 50 ? '#f59e0b' : '#ef4444' }}
              >
                {overall}
              </p>
            </div>
          )}
        </div>

        {urgentReminders.length > 0 && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide mb-1">
              Needs attention
            </p>
            <ul className="space-y-1">
              {urgentReminders.map(r => (
                <li key={r.id} className="text-sm text-zinc-300">• {r.message}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <main className="px-5 pb-8 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && umbrellas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-5xl mb-4">🌂</p>
            <p className="text-zinc-300 font-medium mb-1">No umbrellas yet</p>
            <p className="text-zinc-500 text-sm mb-6">Create your first life area to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Create umbrella
            </button>
          </div>
        )}

        {umbrellas.map(u => (
          <UmbrellaCard key={u.id} umbrella={u} onClick={onSelect} />
        ))}

        {!loading && umbrellas.length > 0 && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900/50 hover:bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-2xl px-4 py-4 text-zinc-500 hover:text-zinc-300 transition-all text-sm"
          >
            + Add umbrella
          </button>
        )}

        {showCreate && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
            <p className="text-sm font-medium text-zinc-300 mb-3">New umbrella</p>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Name (e.g. Health)"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors mb-3"
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {ICON_PICKS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`text-xl w-10 h-10 rounded-xl transition-all ${
                    newIcon === icon
                      ? 'bg-indigo-600 ring-2 ring-indigo-400'
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm rounded-xl py-2 transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setNewIcon('🏠') }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
