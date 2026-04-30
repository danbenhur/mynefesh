import { create } from 'zustand'
import type { Umbrella, Task, HealthSnapshot } from '../types/umbrella'
import * as api from '../lib/api'

function buildTree(flat: api.ApiUmbrella[]): Umbrella[] {
  const sorted = [...flat].sort((a, b) => a.position - b.position)
  const map = new Map<string, Umbrella>()
  for (const u of sorted) {
    map.set(u.id, { ...u, children: [] } as unknown as Umbrella)
  }
  const roots: Umbrella[] = []
  for (const u of map.values()) {
    if (u.parentId) {
      map.get(u.parentId)?.children.push(u)
    } else {
      roots.push(u)
    }
  }
  return roots
}

function patchTree(list: Umbrella[], id: string, fn: (u: Umbrella) => Umbrella): Umbrella[] {
  return list.map(u => {
    if (u.id === id) return fn(u)
    if (u.children.length) return { ...u, children: patchTree(u.children, id, fn) }
    return u
  })
}

function removeFromTree(list: Umbrella[], id: string): Umbrella[] {
  return list
    .filter(u => u.id !== id)
    .map(u => ({ ...u, children: removeFromTree(u.children, id) }))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

interface Store {
  umbrellas: Umbrella[]
  loading: boolean
  error: string | null

  loadUmbrellas: () => Promise<void>
  addUmbrella: (name: string, icon: string, parentId?: string | null) => Promise<void>
  removeUmbrella: (id: string) => Promise<void>

  setHealthScore: (id: string, score: number) => void
  snapshotHealth: (id: string) => void

  addTask: (umbrellaId: string, title: string, priority?: Task['priority'], dueDate?: string) => Promise<void>
  toggleTask: (umbrellaId: string, taskId: string) => void
  deleteTask: (umbrellaId: string, taskId: string) => void

  addNote: (umbrellaId: string, note: string) => void
  deleteNote: (umbrellaId: string, index: number) => void

  dismissReminder: (umbrellaId: string, reminderId: string) => void
}

export const useStore = create<Store>()((set, get) => ({
  umbrellas: [],
  loading: false,
  error: null,

  loadUmbrellas: async () => {
    set({ loading: true, error: null })
    try {
      const flat = await api.listUmbrellas()
      set({ umbrellas: buildTree(flat), loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  addUmbrella: async (name, icon, parentId = null) => {
    await api.createUmbrella({ name, icon, parentId })
    await get().loadUmbrellas()
  },

  removeUmbrella: async (id) => {
    set(state => ({ umbrellas: removeFromTree(state.umbrellas, id) }))
    try {
      await api.deleteUmbrella(id)
    } catch (err) {
      console.error('removeUmbrella:', err)
      get().loadUmbrellas()
    }
  },

  setHealthScore: (id, score) => {
    set(state => ({
      umbrellas: patchTree(state.umbrellas, id, u => ({ ...u, healthScore: score })),
    }))
    api.updateUmbrella(id, { healthScore: score }).catch(err => console.error('setHealthScore:', err))
  },

  snapshotHealth: (id) => {
    const umbrella = findUmbrella(get().umbrellas, id)
    if (!umbrella) return
    const snap: HealthSnapshot = { date: today(), score: umbrella.healthScore }
    set(state => ({
      umbrellas: patchTree(state.umbrellas, id, u => ({
        ...u,
        history: [...u.history.filter(h => h.date !== today()), snap],
      })),
    }))
    api.addHealthScore(id, umbrella.healthScore).catch(err => console.error('snapshotHealth:', err))
  },

  addTask: async (umbrellaId, title, priority = 'medium', dueDate) => {
    try {
      const task = await api.createTask({ umbrellaId, title, priority, dueDate })
      set(state => ({
        umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
          ...u,
          tasks: [...u.tasks, task as unknown as Task],
        })),
      }))
    } catch (err) {
      console.error('addTask:', err)
    }
  },

  toggleTask: (umbrellaId, taskId) => {
    const task = findUmbrella(get().umbrellas, umbrellaId)?.tasks.find(t => t.id === taskId)
    if (!task) return
    const newStatus: Task['status'] = task.status === 'done' ? 'todo' : 'done'
    set(state => ({
      umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
        ...u,
        tasks: u.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
      })),
    }))
    api.updateTask(taskId, { status: newStatus }).catch(err => console.error('toggleTask:', err))
  },

  deleteTask: (umbrellaId, taskId) => {
    set(state => ({
      umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
        ...u,
        tasks: u.tasks.filter(t => t.id !== taskId),
      })),
    }))
    api.deleteTask(taskId).catch(err => console.error('deleteTask:', err))
  },

  addNote: (umbrellaId, note) => {
    set(state => ({
      umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
        ...u,
        notes: [...u.notes, note],
      })),
    }))
    const notes = findUmbrella(get().umbrellas, umbrellaId)?.notes ?? []
    api.updateUmbrella(umbrellaId, { notes }).catch(err => console.error('addNote:', err))
  },

  deleteNote: (umbrellaId, index) => {
    set(state => ({
      umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
        ...u,
        notes: u.notes.filter((_, i) => i !== index),
      })),
    }))
    const notes = findUmbrella(get().umbrellas, umbrellaId)?.notes ?? []
    api.updateUmbrella(umbrellaId, { notes }).catch(err => console.error('deleteNote:', err))
  },

  dismissReminder: (umbrellaId, reminderId) =>
    set(state => ({
      umbrellas: patchTree(state.umbrellas, umbrellaId, u => ({
        ...u,
        reminders: u.reminders.filter(r => r.id !== reminderId),
      })),
    })),
}))

export function findUmbrella(umbrellas: Umbrella[], id: string): Umbrella | null {
  for (const u of umbrellas) {
    if (u.id === id) return u
    const found = findUmbrella(u.children, id)
    if (found) return found
  }
  return null
}
