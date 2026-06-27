const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  try {
    return await res.json()
  } catch (parseErr) {
    // Preserve the HTTP status so callers can distinguish "server rejected" from
    // "server accepted but response body was unreadable" (e.g. proxy garbled the body).
    throw new Error(`API ${res.status}: [json parse failed: ${parseErr}]`)
  }
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
  computedHealthScore: number | null
  notes: string[]
  position: number
  archivedAt: string | null
  updatedAt: string
  tasks: ApiTask[]
  reminders: ApiReminder[]
  history: ApiHealthSnapshot[]
}

export interface ApiUmbrellaTrendPoint {
  date: string
  score: number
}

export interface ApiQuestionTrendPoint {
  date: string
  value: number | null
  answerText: string | null
  answerScale: number | null
  answerBoolean: string | null
}

export const getUmbrellaHealthScores = (days = 14) =>
  req<Record<string, number | null>>(`/api/analytics/umbrellas/health?days=${days}`)

export const getUmbrellaTrend = (id: string, days = 42) =>
  req<ApiUmbrellaTrendPoint[]>(`/api/analytics/umbrellas/${id}/trend?days=${days}`)

export const getQuestionTrend = (id: string, days = 90) =>
  req<ApiQuestionTrendPoint[]>(`/api/analytics/questions/${id}/trend?days=${days}`)

export const listUmbrellas = () =>
  req<ApiUmbrella[]>('/api/umbrellas')

export const listArchivedUmbrellas = () =>
  req<ApiUmbrella[]>('/api/umbrellas?include=archived').then(list => list.filter(u => u.archivedAt !== null))

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
  archivedAt: string | null
}>) => req<ApiUmbrella>(`/api/umbrellas/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const archiveUmbrella = (id: string) =>
  req<ApiUmbrella>(`/api/umbrellas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archivedAt: new Date().toISOString() }),
  })

export const unarchiveUmbrella = (id: string) =>
  req<ApiUmbrella>(`/api/umbrellas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archivedAt: null }),
  })

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

export interface ApiSettings {
  checkinTime: string
  phoneNumber: string
  timezone: string
  shabbatMode: boolean
  saturdayCheckinTime: string | null
}

export const getSettings = () =>
  req<ApiSettings>('/api/settings')

export const updateSettings = (patch: Partial<Pick<ApiSettings, 'checkinTime' | 'phoneNumber' | 'shabbatMode' | 'saturdayCheckinTime'>>) =>
  req<ApiSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) })

export interface ApiQuestion {
  id: string
  umbrellaId: string
  text: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'annual'
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfYear: number | null
  answerType: 'text' | 'scale' | 'boolean' | 'boolean_partial' | 'multi_select'
  scaleMin: number | null
  scaleMax: number | null
  options: string[] | null
  position: number
  enabled: boolean
}

export const listQuestions = (umbrellaId: string) =>
  req<ApiQuestion[]>(`/api/umbrellas/${umbrellaId}/questions`)

export const createQuestion = (umbrellaId: string, body: Omit<ApiQuestion, 'id' | 'umbrellaId'>) =>
  req<ApiQuestion>(`/api/umbrellas/${umbrellaId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const updateQuestion = (id: string, patch: Partial<Omit<ApiQuestion, 'id' | 'umbrellaId'>>) =>
  req<ApiQuestion>(`/api/questions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const deleteQuestion = (id: string) =>
  req<void>(`/api/questions/${id}`, { method: 'DELETE' })

export interface ApiSandboxStatus {
  sandboxStatus: 'unknown' | 'active' | 'expired'
  lastSandboxJoinAt: string | null
  lastDeliveryFailureAt: string | null
}

export const getSandboxStatus = () =>
  req<ApiSandboxStatus>('/api/sandbox/status')

export const markSandboxJoined = () =>
  req<{ ok: boolean; lastSandboxJoinAt: string }>('/api/sandbox/joined', { method: 'POST' })

export interface ApiComposedQuestion {
  id: string
  umbrellaId: string
  umbrellaName: string
  umbrellaIcon: string
  umbrellaColor: string | null
  text: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'annual'
  answerType: 'text' | 'scale' | 'boolean' | 'boolean_partial' | 'multi_select'
  scaleMin: number | null
  scaleMax: number | null
  options: string[] | null
  position: number
}

export interface ApiInterviewSession {
  id: string
  date: string
  startedAt: string | null
  completedAt: string | null
  currentIndex: number
}

export interface ApiTodaysInterview {
  questions: ApiComposedQuestion[]
  session: ApiInterviewSession
}

export const getTodaysInterview = () =>
  req<ApiTodaysInterview>('/api/interview/today')

export const submitInterviewAnswer = (payload: {
  questionId: string
  answerText?: string
  answerScale?: number
  answerBoolean?: 'yes' | 'no' | 'partial'
  answerOptions?: string[]
  comment?: string | null
}) =>
  req<{ id: string; questionId: string; interviewDate: string; answerNormalized: number | null }>(
    '/api/interview/answer',
    { method: 'POST', body: JSON.stringify(payload) }
  )

export interface ApiMultiTrendPoint {
  option: string
  total: number
}

export const getQuestionMultiTrend = (questionId: string, days = 90) =>
  req<ApiMultiTrendPoint[]>(`/api/analytics/questions/${questionId}/multi-trend?days=${days}`)

export const completeInterview = () =>
  req<{ id: string; date: string; completedAt: string }>('/api/interview/complete', { method: 'POST' })

export interface ApiInterviewHistoryAnswer {
  id: string
  questionId: string
  interviewDate: string
  answerText: string | null
  answerScale: number | null
  answerBoolean: 'yes' | 'no' | 'partial' | null
  answerNormalized: number | null
}

export interface ApiInterviewHistory {
  sessions: ApiInterviewSession[]
  answers: ApiInterviewHistoryAnswer[]
}

export const getInterviewHistory = (days = 30) =>
  req<ApiInterviewHistory>(`/api/interview/history?days=${days}`)

export interface ApiResolutionProgress {
  successfulDays: number
  elapsedDays: number
  totalDays: number
  percentage: number
  currentStreak: number
  longestStreak: number
  daysRemaining: number
}

export interface ApiResolution {
  id: string
  umbrellaId: string
  questionId: string
  title: string
  startDate: string
  endDate: string
  successThreshold: number | null
  status: 'active' | 'completed' | 'abandoned'
  finalScore: number | null
  createdAt: string
  progress: ApiResolutionProgress | null
}

export const listResolutions = (umbrellaId: string) =>
  req<ApiResolution[]>(`/api/umbrellas/${umbrellaId}/resolutions`)

export const createResolution = (payload: {
  umbrellaId: string
  questionId?: string
  newQuestion?: { text: string; answerType: 'boolean' | 'boolean_partial' | 'scale'; scaleMin?: number; scaleMax?: number }
  title: string
  startDate: string
  endDate: string
  successThreshold?: number | null
}) => req<ApiResolution>('/api/resolutions', { method: 'POST', body: JSON.stringify(payload) })

export const updateResolution = (id: string, patch: { title?: string; endDate?: string; status?: 'abandoned' }) =>
  req<ApiResolution>(`/api/resolutions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const getResolutionProgress = (id: string) =>
  req<ApiResolutionProgress>(`/api/resolutions/${id}/progress`)

export const abandonResolution = (id: string) =>
  req<ApiResolution>(`/api/resolutions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'abandoned' }) })

// ── Timeseries (HeroChart) ────────────────────────────────────────────────────

export type TimeseriesSlice = 'combo' | 'stacked' | 'question' | 'goal' | 'movingavg'
export type TimeseriesGranularity = 'day' | 'week' | 'month' | 'year'

export interface ChartSegment {
  umbrellaId: string
  name: string
  color: string
  value: number
}

export interface TimeseriesPoint {
  label: string
  score: number
  bars: number
  segments?: ChartSegment[]
}

export interface TimeseriesResponse {
  points: TimeseriesPoint[]
  projection: number
  umbrellas?: Array<{ id: string; name: string; color: string }>
}

export const getTimeseries = (slice: TimeseriesSlice, granularity: TimeseriesGranularity) =>
  req<TimeseriesResponse>(`/api/analytics/timeseries?slice=${slice}&granularity=${granularity}`)

// ── Onboarding ────────────────────────────────────────────────────────────────

export const completeOnboarding = (umbrellaList: Array<{ name: string; icon: string }>) =>
  req<{ ok: boolean }>('/api/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ umbrellas: umbrellaList }),
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface ApiInvite {
  id: string
  email: string
  notes: string | null
  invitedAt: string
  revokedAt: string | null
}

export const listInvites = () =>
  req<ApiInvite[]>('/api/admin/invites')

export const addInvite = (email: string, notes?: string) =>
  req<ApiInvite>('/api/admin/invites', {
    method: 'POST',
    body: JSON.stringify({ email, notes }),
  })

export const revokeInvite = (id: string) =>
  req<{ ok: boolean; revokedAt: string }>(`/api/admin/invites/${id}`, { method: 'DELETE' })
