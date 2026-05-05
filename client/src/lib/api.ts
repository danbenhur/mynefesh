const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface ApiTask {
  id: string
  umbrellaId: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  position: number
}

export interface ApiReminder {
  id: string
  umbrellaId: string
  message: string
  triggerDate: string
  isRecurring: boolean
}

export interface ApiHealthSnapshot {
  date: string
  score: number
}

export interface ApiUmbrella {
  id: string
  name: string
  icon: string
  parentId: string | null
  healthScore: number
  notes: string[]
  position: number
  tasks: ApiTask[]
  reminders: ApiReminder[]
  history: ApiHealthSnapshot[]
}

export const listUmbrellas = () =>
  req<ApiUmbrella[]>('/api/umbrellas')

export const createUmbrella = (body: {
  name: string
  icon?: string
  parentId?: string | null
  healthScore?: number
  position?: number
}) => req<ApiUmbrella>('/api/umbrellas', { method: 'POST', body: JSON.stringify(body) })

export const updateUmbrella = (id: string, body: Partial<{
  name: string
  icon: string
  parentId: string | null
  healthScore: number
  notes: string[]
  position: number
}>) => req<ApiUmbrella>(`/api/umbrellas/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteUmbrella = (id: string) =>
  req<void>(`/api/umbrellas/${id}`, { method: 'DELETE' })

export const createTask = (body: {
  umbrellaId: string
  title: string
  priority?: string
  dueDate?: string
  position?: number
}) => req<ApiTask>('/api/tasks', { method: 'POST', body: JSON.stringify(body) })

export const updateTask = (id: string, body: Partial<{
  title: string
  status: string
  priority: string
  dueDate: string | null
  position: number
}>) => req<ApiTask>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const deleteTask = (id: string) =>
  req<void>(`/api/tasks/${id}`, { method: 'DELETE' })

export const addHealthScore = (umbrellaId: string, score: number) =>
  req<ApiHealthSnapshot>('/api/health-history', {
    method: 'POST',
    body: JSON.stringify({ umbrellaId, score }),
  })

export const getChatHistory = (limit = 50) =>
  req<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>>(
    `/api/chat/history?limit=${limit}`
  )

export const getHealthHistory = (umbrellaId: string, days = 42) =>
  req<ApiHealthSnapshot[]>(`/api/health-history?umbrella=${umbrellaId}&days=${days}`)
