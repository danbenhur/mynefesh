import type { Umbrella } from '../types/umbrella'
import HealthRing from './HealthRing'

interface Props {
  umbrella: Umbrella
  onClick: (u: Umbrella) => void
}

function trend(history: Umbrella['history']): 'up' | 'down' | 'flat' {
  if (history.length < 2) return 'flat'
  const delta = history[history.length - 1].score - history[history.length - 2].score
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

const trendIcon = { up: '↑', down: '↓', flat: '→' }
const trendColor = { up: 'text-green-400', down: 'text-red-400', flat: 'text-zinc-400' }

export default function UmbrellaCard({ umbrella, onClick }: Props) {
  const t = trend(umbrella.history)
  const openTasks = umbrella.tasks.filter(t => t.status !== 'done').length
  const urgentReminders = umbrella.reminders.filter(r => {
    const due = new Date(r.triggerDate)
    const now = new Date()
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 3
  }).length

  return (
    <button
      onClick={() => onClick(umbrella)}
      className="group w-full text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl leading-none">{umbrella.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold text-lg leading-tight">{umbrella.name}</h2>
            <span className={`text-sm font-bold ${trendColor[t]}`}>{trendIcon[t]}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
            {umbrella.children.length > 0 && (
              <span>{umbrella.children.length} areas</span>
            )}
            {openTasks > 0 && (
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                {openTasks} task{openTasks > 1 ? 's' : ''}
              </span>
            )}
            {urgentReminders > 0 && (
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {urgentReminders} reminder{urgentReminders > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <HealthRing score={umbrella.healthScore} />
      </div>

      {umbrella.children.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {umbrella.children.map(child => (
            <div key={child.id} className="flex items-center gap-2 bg-zinc-950/50 rounded-xl px-3 py-2">
              <span className="text-base">{child.icon}</span>
              <span className="text-xs text-zinc-300 font-medium truncate flex-1">{child.name}</span>
              <HealthRing score={child.healthScore} size={36} />
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
