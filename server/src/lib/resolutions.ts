import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { questionAnswers } from '../db/schema.js'

export interface ResolutionProgressResult {
  successfulDays: number
  elapsedDays: number
  totalDays: number
  percentage: number
  currentStreak: number
  longestStreak: number
  daysRemaining: number
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00Z').getTime()
  const e = new Date(end + 'T12:00:00Z').getTime()
  return Math.round((e - s) / 86400000)
}

export function todayJerusalem(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function computeResolutionProgress(
  resolution: {
    questionId: string
    startDate: string
    endDate: string
    successThreshold: number | null
  },
  questionAnswerType: string,
): Promise<ResolutionProgressResult> {
  const db = getDb()
  const today = todayJerusalem()

  const effectiveEnd = today <= resolution.endDate ? today : resolution.endDate
  const totalDays = daysBetween(resolution.startDate, resolution.endDate) + 1
  const daysRemaining = Math.max(0, daysBetween(today, resolution.endDate))

  if (today < resolution.startDate) {
    return { successfulDays: 0, elapsedDays: 0, totalDays, percentage: 0, currentStreak: 0, longestStreak: 0, daysRemaining }
  }

  const elapsedDays = daysBetween(resolution.startDate, effectiveEnd) + 1

  const rows = await db
    .select({
      interviewDate: questionAnswers.interviewDate,
      answerBoolean: questionAnswers.answerBoolean,
      answerScale: questionAnswers.answerScale,
    })
    .from(questionAnswers)
    .where(and(
      eq(questionAnswers.questionId, resolution.questionId),
      gte(questionAnswers.interviewDate, resolution.startDate),
      lte(questionAnswers.interviewDate, effectiveEnd),
    ))

  const successDates = new Set<string>()
  const answeredDates = new Set<string>()

  for (const row of rows) {
    const d = String(row.interviewDate).slice(0, 10)
    answeredDates.add(d)
    let isSuccess = false
    if (questionAnswerType === 'boolean' || questionAnswerType === 'boolean_partial') {
      isSuccess = row.answerBoolean === 'yes'
    } else if (questionAnswerType === 'scale' && resolution.successThreshold != null && row.answerScale != null) {
      isSuccess = row.answerScale >= resolution.successThreshold
    }
    if (isSuccess) successDates.add(d)
  }

  // Build ordered date list from startDate to effectiveEnd
  const allDates: string[] = []
  let cursor = resolution.startDate
  while (cursor <= effectiveEnd) {
    allDates.push(cursor)
    cursor = addDays(cursor, 1)
  }

  // longestStreak: longest run of consecutive success days
  let longestStreak = 0
  let runningStreak = 0
  for (const d of allDates) {
    if (successDates.has(d)) {
      runningStreak++
      if (runningStreak > longestStreak) longestStreak = runningStreak
    } else {
      runningStreak = 0
    }
  }

  // currentStreak: consecutive successes ending at the last answered date
  let currentStreak = 0
  let lastAnsweredIdx = -1
  for (let i = allDates.length - 1; i >= 0; i--) {
    if (answeredDates.has(allDates[i])) { lastAnsweredIdx = i; break }
  }
  if (lastAnsweredIdx >= 0) {
    for (let i = lastAnsweredIdx; i >= 0; i--) {
      if (successDates.has(allDates[i])) currentStreak++
      else break
    }
  }

  const successfulDays = successDates.size
  const percentage = elapsedDays > 0 ? Math.round((successfulDays / elapsedDays) * 100) : 0

  return { successfulDays, elapsedDays, totalDays, percentage, currentStreak, longestStreak, daysRemaining }
}
