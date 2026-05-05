import { useState } from 'react'
import type { Umbrella } from '../types/umbrella'
import { useStore } from '../store/useStore'
import HealthRing from './HealthRing'
import Sparkline from './Sparkline'

interface Props {
  umbrella: Umbrella
  onBack: () => void
  onSelectChild: (u: Umbrella) => void
}

const priorityColor = {
  high: 'text-red-400 bg-red-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  low: 'text-zinc-400 bg-zinc-700/50',
}

export default function UmbrellaDetail({ umbrella, onBack, onSelectChild }: Props) {
  const { setHealthScore, snapshotHealth, addTask, toggleTask, deleteTask, addNote, deleteNote, dismissReminder } = useStore()

  const [newTask, setNewTask] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newNote, setNewNote] = useState('')
  const [editingScore, setEditingScore] = useState(false)
  const [draftScore, setDraftScore] = useState(umbrella.healthScore)

  function handleSaveScore() {
    setHealthScore(umbrella.id, draftScore)
    snapshotHealth(umbrella.id)
    setEditingScore(false)
  }

  function handleAddTask() {
    if (!newTask.trim()) return
    addTask(umbrella.id, newTask.trim(), taskPriority)
    setNewTask('')
  }

  function handleAddNote() {
    if (!newNote.trim()) return
    addNote(umbrella.id, newNote.trim())
    setNewNote('')
  }

  const openTasks = umbrella.tasks.filter(t => t.status !== 'done')
  const doneTasks = umbrella.tasks.filter(t => t.status === 'done')

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="px-5 pt-8 pb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white mb-5 transition-colors text-sm"
        >
          ← Back
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{umbrella.icon}</span>
            <div>
              <h1 className="text-2xl font-bold">{umbrella.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Sparkline data={umbrella.history.map(h => h.score)} color="#9CAF88" />
              </div>
            </div>
          </div>
          <button onClick={() => { setDraftScore(umbrella.healthScore); setEditingScore(true) }}>
            <HealthRing score={umbrella.healthScore} size={64} />
          </button>
        </div>

        {/* Score editor */}
        {editingScore && (
          <div className="mt-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
            <p className="text-sm text-zinc-400 mb-3">Update health score</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={draftScore}
                onChange={e => setDraftScore(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-white font-bold w-8 text-right">{draftScore}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveScore}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl py-2 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingScore(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 space-y-6 pb-24">
        {/* Sub-umbrellas */}
        {umbrella.children.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Areas</h2>
            <div className="grid grid-cols-2 gap-2">
              {umbrella.children.map(child => (
                <button
                  key={child.id}
                  onClick={() => onSelectChild(child)}
                  className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-xl px-3 py-3 transition-all text-left"
                >
                  <span className="text-2xl">{child.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{child.name}</p>
                    <Sparkline data={child.history.map(h => h.score)} color="#9CAF88" width={60} height={20} />
                  </div>
                  <HealthRing score={child.healthScore} size={40} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Reminders */}
        {umbrella.reminders.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Reminders</h2>
            <div className="space-y-2">
              {umbrella.reminders.map(r => (
                <div key={r.id} className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <span className="text-amber-400 mt-0.5">🔔</span>
                  <p className="flex-1 text-sm text-zinc-200">{r.message}</p>
                  <button
                    onClick={() => dismissReminder(umbrella.id, r.id)}
                    className="text-zinc-500 hover:text-zinc-300 text-lg leading-none transition-colors"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tasks */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tasks</h2>

          {/* Add task */}
          <div className="flex gap-2 mb-3">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a task..."
              className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
            />
            <select
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as typeof taskPriority)}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl px-3 py-2 text-sm transition-colors"
            >
              Add
            </button>
          </div>

          {/* Open tasks */}
          {openTasks.length === 0 && (
            <p className="text-zinc-600 text-sm">No open tasks.</p>
          )}
          <div className="space-y-2">
            {openTasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <button
                  onClick={() => toggleTask(umbrella.id, t.id)}
                  className="w-5 h-5 rounded-full border-2 border-zinc-600 hover:border-indigo-400 transition-colors shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{t.title}</p>
                  {t.dueDate && (
                    <p className="text-xs text-zinc-500 mt-0.5">Due {t.dueDate}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor[t.priority]}`}>
                  {t.priority}
                </span>
                <button
                  onClick={() => deleteTask(umbrella.id, t.id)}
                  className="text-zinc-600 hover:text-red-400 text-lg leading-none transition-colors"
                  aria-label="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-zinc-600 mb-2">Done ({doneTasks.length})</p>
              {doneTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 opacity-40">
                  <button
                    onClick={() => toggleTask(umbrella.id, t.id)}
                    className="w-5 h-5 rounded-full bg-green-600 border-2 border-green-600 shrink-0 flex items-center justify-center text-white text-xs"
                  >
                    ✓
                  </button>
                  <p className="text-sm text-zinc-400 line-through flex-1">{t.title}</p>
                  <button
                    onClick={() => deleteTask(umbrella.id, t.id)}
                    className="text-zinc-600 hover:text-red-400 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Notes</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 text-zinc-300 rounded-xl px-3 py-2 text-sm transition-colors"
            >
              Add
            </button>
          </div>
          {umbrella.notes.length === 0 && (
            <p className="text-zinc-600 text-sm">No notes yet.</p>
          )}
          <div className="space-y-2">
            {umbrella.notes.map((note, i) => (
              <div key={i} className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <p className="flex-1 text-sm text-zinc-300 whitespace-pre-wrap">{note}</p>
                <button
                  onClick={() => deleteNote(umbrella.id, i)}
                  className="text-zinc-600 hover:text-red-400 text-lg leading-none transition-colors shrink-0"
                  aria-label="Delete note"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
