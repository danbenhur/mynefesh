export interface HealthSnapshot {
  date: string
  score: number
}

export interface Task {
  id: string
  title: string
  umbrellaId: string
  dueDate?: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in-progress' | 'done'
}

export interface Reminder {
  id: string
  message: string
  triggerDate: string
  umbrellaId: string
  isRecurring: boolean
}

export interface Person {
  id: string
  name: string
  relationship: string
  birthday?: string
  lastContact?: string
  notes: string[]
  umbrellaId: string
}

export interface Umbrella {
  id: string
  name: string
  icon: string
  parentId: string | null
  healthScore: number
  notes: string[]
  tasks: Task[]
  reminders: Reminder[]
  children: Umbrella[]
  history: HealthSnapshot[]
}
