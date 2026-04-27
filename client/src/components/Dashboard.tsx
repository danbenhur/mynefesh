import { useStore } from '../store/useStore'
import type { Umbrella } from '../types/umbrella'
import UmbrellaCard from './UmbrellaCard'

interface Props {
  onSelect: (u: Umbrella) => void
}

function overallScore(umbrellas: Umbrella[]) {
  return Math.round(umbrellas.reduce((sum, u) => sum + u.healthScore, 0) / umbrellas.length)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard({ onSelect }: Props) {
  const umbrellas = useStore(s => s.umbrellas)
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
          <div className="text-right">
            <p className="text-zinc-400 text-xs mb-1">Overall health</p>
            <p
              className="text-3xl font-bold"
              style={{ color: overall >= 75 ? '#22c55e' : overall >= 50 ? '#f59e0b' : '#ef4444' }}
            >
              {overall}
            </p>
          </div>
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
        {umbrellas.map(u => (
          <UmbrellaCard key={u.id} umbrella={u} onClick={onSelect} />
        ))}
      </main>
    </div>
  )
}
