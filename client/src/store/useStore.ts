import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { umbrellas as seedData } from '../data/umbrellas'
import type { Umbrella, Task, HealthSnapshot } from '../types/umbrella'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function updateUmbrella(list: Umbrella[], id: string, fn: (u: Umbrella) => Umbrella): Umbrella[] {
  return list.map(u => {
    if (u.id === id) return fn(u)
    if (u.children.length) return { ...u, children: updateUmbrella(u.children, id, fn) }
    return u
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

interface Store {
  umbrellas: Umbrella[]

  setHealthScore: (id: string, score: number) => void
  snapshotHealth: (id: string) => void

  addTask: (umbrellaId: string, title: string, priority?: Task['priority'], dueDate?: string) => void
  toggleTask: (umbrellaId: string, taskId: string) => void
  deleteTask: (umbrellaId: string, taskId: string) => void

  addNote: (umbrellaId: string, note: string) => void
  deleteNote: (umbrellaId: string, index: number) => void

  dismissReminder: (umbrellaId: string, reminderId: string) => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      umbrellas: seedData,

      setHealthScore: (id, score) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, id, u => ({ ...u, healthScore: score })),
        })),

      snapshotHealth: (id) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, id, u => {
            const snap: HealthSnapshot = { date: today(), score: u.healthScore }
            const history = [...u.history.filter(h => h.date !== today()), snap]
            return { ...u, history }
          }),
        })),

      addTask: (umbrellaId, title, priority = 'medium', dueDate) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            tasks: [
              ...u.tasks,
              { id: uid(), title, umbrellaId, priority, status: 'todo', dueDate },
            ],
          })),
        })),

      toggleTask: (umbrellaId, taskId) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            tasks: u.tasks.map(t =>
              t.id === taskId
                ? { ...t, status: t.status === 'done' ? 'todo' : 'done' }
                : t
            ),
          })),
        })),

      deleteTask: (umbrellaId, taskId) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            tasks: u.tasks.filter(t => t.id !== taskId),
          })),
        })),

      addNote: (umbrellaId, note) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            notes: [...u.notes, note],
          })),
        })),

      deleteNote: (umbrellaId, index) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            notes: u.notes.filter((_, i) => i !== index),
          })),
        })),

      dismissReminder: (umbrellaId, reminderId) =>
        set(state => ({
          umbrellas: updateUmbrella(state.umbrellas, umbrellaId, u => ({
            ...u,
            reminders: u.reminders.filter(r => r.id !== reminderId),
          })),
        })),
    }),
    { name: 'mynefesh-store' }
  )
)

export function findUmbrella(umbrellas: Umbrella[], id: string): Umbrella | null {
  for (const u of umbrellas) {
    if (u.id === id) return u
    const found = findUmbrella(u.children, id)
    if (found) return found
  }
  return null
}
