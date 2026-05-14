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
  computedHealthScore: number | null
  notes: string[]
  tasks: Task[]
  reminders: Reminder[]
  children: Umbrella[]
  history: HealthSnapshot[]
  archivedAt: string | null
  computedTrend: number[]  // daily scores 0-100, from analytics, may be empty
}

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'annual'
export type AnswerType = 'text' | 'scale' | 'boolean' | 'boolean_partial'

export interface Question {
  id: string
  umbrellaId: string
  text: string
  cadence: Cadence
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfYear: number | null
  answerType: AnswerType
  scaleMin: number | null
  scaleMax: number | null
  position: number
  enabled: boolean
}
