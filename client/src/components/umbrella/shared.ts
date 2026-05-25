import { T } from '../../lib/theme'
import type { Question, Cadence, AnswerType, Umbrella } from '../../types/umbrella'

export const PRIORITY_COLOR: Record<string, string> = {
  high: T.red,
  medium: T.amber,
  low: T.blue,
}

export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export const CADENCE_COLOR: Record<Cadence, string> = {
  daily: T.sage,
  weekly: T.blue,
  monthly: T.amber,
  annual: T.purple,
}

export const CADENCE_HE: Record<Cadence, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  annual: 'שנתי',
}

export const EMOJI_OPTIONS = ['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼', '🎯', '🔥', '⚡', '🌟']

export function cadenceLabel(q: Question): string {
  if (q.cadence === 'daily') return 'יומי'
  if (q.cadence === 'weekly') return `שבועי - ${q.dayOfWeek !== null ? HE_DAYS[q.dayOfWeek] : '?'}`
  if (q.cadence === 'monthly') return `חודשי - ${q.dayOfMonth ?? '?'}`
  if (q.cadence === 'annual') return `שנתי - ${q.dayOfMonth ?? '?'}/${q.monthOfYear ?? '?'}`
  return q.cadence
}

export function relativeDate(dateStr: string): string {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diffDays === 0) return 'היום'
  if (diffDays === 1) return 'אתמול'
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  if (diffDays < 30) return `לפני ${Math.round(diffDays / 7)} שבועות`
  return `לפני ${Math.round(diffDays / 30)} חודשים`
}

export function lastActivity(u: Umbrella): string {
  if (!u.history.length) return '—'
  const sorted = [...u.history].sort((a, b) => b.date.localeCompare(a.date))
  return relativeDate(sorted[0].date)
}

export function childSparkData(u: Umbrella): number[] {
  if (u.computedTrend && u.computedTrend.length > 0) return u.computedTrend
  return [...u.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => h.score)
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function todayClientStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addClientDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function flattenWithDepth(list: Umbrella[], depth = 0): Array<{ u: Umbrella; depth: number }> {
  return list.flatMap(u => [{ u, depth }, ...flattenWithDepth(u.children, depth + 1)])
}

export function collectDescendantIds(u: Umbrella): Set<string> {
  const ids = new Set<string>()
  function walk(node: Umbrella) { ids.add(node.id); node.children.forEach(walk) }
  u.children.forEach(walk)
  return ids
}

// ─── Question form ─────────────────────────────────────────────────────────────

export interface FormState {
  text: string
  cadence: Cadence
  dayOfWeek: number
  dayOfMonth: number
  monthOfYear: number
  answerType: AnswerType
  scaleMin: number
  scaleMax: number
  options: string[]
}

export const DEFAULT_FORM: FormState = {
  text: '',
  cadence: 'daily',
  dayOfWeek: 0,
  dayOfMonth: 1,
  monthOfYear: 1,
  answerType: 'text',
  scaleMin: 1,
  scaleMax: 5,
  options: [],
}

export function questionToForm(q: Question): FormState {
  return {
    text: q.text,
    cadence: q.cadence,
    dayOfWeek: q.dayOfWeek ?? 0,
    dayOfMonth: q.dayOfMonth ?? 1,
    monthOfYear: q.monthOfYear ?? 1,
    answerType: q.answerType,
    scaleMin: q.scaleMin ?? 1,
    scaleMax: q.scaleMax ?? 5,
    options: q.options ?? [],
  }
}

export function formToPayload(f: FormState) {
  return {
    text: f.text,
    cadence: f.cadence,
    dayOfWeek: f.cadence === 'weekly' ? f.dayOfWeek : null,
    dayOfMonth: (f.cadence === 'monthly' || f.cadence === 'annual') ? f.dayOfMonth : null,
    monthOfYear: f.cadence === 'annual' ? f.monthOfYear : null,
    answerType: f.answerType,
    scaleMin: f.answerType === 'scale' ? f.scaleMin : null,
    scaleMax: f.answerType === 'scale' ? f.scaleMax : null,
    options: f.answerType === 'multi_select' ? f.options : null,
    position: 0,
    enabled: true,
  }
}

// ─── Resolution form ───────────────────────────────────────────────────────────

export type ResolutionQSource = 'existing' | 'new'
export type ResolutionDuration = '30' | '90' | '180' | 'custom'

export interface ResolutionFormState {
  title: string
  qSource: ResolutionQSource
  existingQId: string
  newQText: string
  newQType: 'boolean' | 'boolean_partial' | 'scale'
  newQScaleMin: number
  newQScaleMax: number
  duration: ResolutionDuration
  customEnd: string
  successThreshold: string
}

export const DEFAULT_RESOLUTION_FORM: ResolutionFormState = {
  title: '',
  qSource: 'existing',
  existingQId: '',
  newQText: '',
  newQType: 'boolean',
  newQScaleMin: 1,
  newQScaleMax: 10,
  duration: '30',
  customEnd: '',
  successThreshold: '',
}

export function resolutionEndDate(form: ResolutionFormState): string {
  const today = todayClientStr()
  if (form.duration === '30') return addClientDays(today, 30)
  if (form.duration === '90') return addClientDays(today, 90)
  if (form.duration === '180') return addClientDays(today, 180)
  return form.customEnd || addClientDays(today, 30)
}

export function resolutionQType(form: ResolutionFormState, questions: Question[]): string {
  if (form.qSource === 'new') return form.newQType
  return questions.find(q => q.id === form.existingQId)?.answerType ?? ''
}
